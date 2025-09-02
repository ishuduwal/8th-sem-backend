import { Request, Response, NextFunction } from 'express';
import Order, { IOrder, IOrderItem } from '../model/Order';
import Product, { IProduct } from '../model/Product';
import Cart from '../model/Cart';
import mongoose from 'mongoose';
import { 
  generateTransactionUuid, 
  prepareEsewaPaymentData, 
  checkEsewaPaymentStatus,
  verifyEsewaSignature,
  decodeEsewaResponse,
  ESEWA_CONFIG
} from '../utils/Esewa';

// Create new order from cart
export const createOrderFromCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      userId,
      deliveryAddress, 
      paymentMethod, 
      taxAmount = 0, 
      deliveryCharge = 0, 
      notes 
    } = req.body;

    // Validation
    if (!userId) {
      await session.abortTransaction();
      res.status(400).json({ message: 'User ID is required' });
      return;
    }

    if (!deliveryAddress || !deliveryAddress.fullName || !deliveryAddress.phoneNumber || !deliveryAddress.address || !deliveryAddress.city) {
      await session.abortTransaction();
      res.status(400).json({ message: 'Complete delivery address is required' });
      return;
    }

    if (!['CASH_ON_DELIVERY', 'ESEWA'].includes(paymentMethod)) {
      await session.abortTransaction();
      res.status(400).json({ message: 'Invalid payment method' });
      return;
    }

    // Get user's cart
    const cart = await Cart.findOne({ userId }).session(session);
    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      res.status(400).json({ message: 'Cart is empty' });
      return;
    }

    // Validate cart items and check stock
    let totalAmount = 0;
    const validatedItems: IOrderItem[] = [];

    for (const cartItem of cart.items) {
      const product = await Product.findById(cartItem.product).session(session) as IProduct | null;
      if (!product) {
        await session.abortTransaction();
        res.status(400).json({ message: `Product not found: ${cartItem.name}` });
        return;
      }

      if (product.stock < cartItem.quantity) {
        await session.abortTransaction();
        res.status(400).json({ 
          message: `Insufficient stock for product: ${product.name}`,
          details: {
            productId: product._id,
            productName: product.name,
            availableStock: product.stock,
            requestedQuantity: cartItem.quantity
          }
        });
        return;
      }

      const itemTotal = cartItem.price * cartItem.quantity;
      totalAmount += itemTotal;

      validatedItems.push({
        product: product._id as mongoose.Types.ObjectId,
        quantity: cartItem.quantity,
        price: cartItem.price
      });
    }

    const grandTotal = totalAmount + taxAmount + deliveryCharge;

    // Create order data
    const orderData: Partial<IOrder> = {
      userInfo: {
        userId,
        username: req.body.username 
      },
      items: validatedItems,
      deliveryAddress,
      paymentMethod,
      totalAmount,
      taxAmount,
      deliveryCharge,
      grandTotal,
      notes,
      // Set appropriate initial statuses based on payment method
      paymentStatus: paymentMethod === 'CASH_ON_DELIVERY' ? 'PENDING' : 'PENDING',
      orderStatus: 'PENDING'
    };

    // Add eSewa transaction UUID if needed
    if (paymentMethod === 'ESEWA') {
      orderData.esewaTransactionUuid = generateTransactionUuid();
    }

    const order = new Order(orderData);
    await order.save({ session });

    // For eSewa, don't reduce stock or clear cart until payment is confirmed
    // For COD, reduce stock and clear cart immediately since it's confirmed
    if (paymentMethod === 'CASH_ON_DELIVERY') {
      // Reduce product stock for COD orders
      for (const cartItem of cart.items) {
        const product = await Product.findById(cartItem.product).session(session);
        if (product) {
          product.stock -= cartItem.quantity;
          await product.save({ session });
        }
      }

      // Clear cart after successful COD order creation
      cart.items = [];
      await cart.save({ session });
      
      // Update order status to confirmed for COD
      order.orderStatus = 'CONFIRMED';
      await order.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Populate order for response
    const populatedOrder = await Order.findById(order._id)
      .populate('items.product', 'name price mainImage');

    // Handle eSewa payment
    if (paymentMethod === 'ESEWA') {
      const paymentData = prepareEsewaPaymentData(
        totalAmount,
        taxAmount,
        deliveryCharge,
        order.esewaTransactionUuid!
      );

      res.status(201).json({
        message: 'Order created successfully. Complete payment to confirm.',
        order: populatedOrder,
        paymentData,
        instructions: {
          message: 'To complete payment, submit a POST request to the gateway_url with the payment form data',
          method: 'POST',
          url: paymentData.gateway_url,
          formData: {
            amount: paymentData.amount,
            tax_amount: paymentData.tax_amount,
            total_amount: paymentData.total_amount,
            transaction_uuid: paymentData.transaction_uuid,
            product_code: paymentData.product_code,
            product_service_charge: paymentData.product_service_charge,
            product_delivery_charge: paymentData.product_delivery_charge,
            success_url: paymentData.success_url,
            failure_url: paymentData.failure_url,
            signed_field_names: paymentData.signed_field_names,
            signature: paymentData.signature
          }
        }
      });
      return;
    }

    res.status(201).json({
      message: 'Order created successfully',
      order: populatedOrder
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create order from cart error:', error);
    next(error);
  }
};

export const handleEsewaSuccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { data } = req.query; 

    if (!data) {
      res.status(400).json({ message: 'Payment response data is required' });
      return;
    }

    console.log('Received eSewa success data:', data);

    const paymentResponse = decodeEsewaResponse(data as string);
    console.log('Decoded payment response:', paymentResponse);

    const { 
      transaction_code,
      status,
      total_amount, 
      transaction_uuid, 
      product_code, 
      signed_field_names,
      signature
    } = paymentResponse;

    // Verify signature
    const isValidSignature = verifyEsewaSignature(
      transaction_code,
      status,
      total_amount,
      transaction_uuid,
      product_code,
      signed_field_names,
      signature
    );

    if (!isValidSignature) {
      await session.abortTransaction();
      res.status(400).json({ message: 'Invalid payment signature' });
      return;
    }

    // Find order
    const order = await Order.findOne({ esewaTransactionUuid: transaction_uuid }).session(session);
    if (!order) {
      await session.abortTransaction();
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Double-check payment status with eSewa
    try {
      const statusResponse = await checkEsewaPaymentStatus(
        product_code,
        parseInt(total_amount),
        transaction_uuid
      );

      console.log('eSewa status check response:', statusResponse);

      if (status === 'COMPLETE' && statusResponse.status === 'COMPLETE') {
        // Payment successful - now reduce stock and clear cart
        order.paymentStatus = 'PAID';
        order.orderStatus = 'CONFIRMED';
        order.esewaTransactionCode = transaction_code;
        order.esewaRefId = statusResponse.ref_id;
        order.esewaSignature = signature;

        // Reduce product stock
        for (const orderItem of order.items) {
          const product = await Product.findById(orderItem.product).session(session);
          if (product) {
            product.stock -= orderItem.quantity;
            await product.save({ session });
          }
        }

        // Clear user's cart
        const cart = await Cart.findOne({ userId: order.userInfo.userId }).session(session);
        if (cart) {
          cart.items = [];
          await cart.save({ session });
        }

      } else {
        order.paymentStatus = 'FAILED';
        order.orderStatus = 'CANCELLED';
      }

    } catch (statusError) {
      console.error('Status check failed:', statusError);
      // If status check fails but signature is valid and status is COMPLETE, still proceed
      if (status === 'COMPLETE') {
        order.paymentStatus = 'PAID';
        order.orderStatus = 'CONFIRMED';
        order.esewaTransactionCode = transaction_code;
        order.esewaSignature = signature;

        // Reduce product stock
        for (const orderItem of order.items) {
          const product = await Product.findById(orderItem.product).session(session);
          if (product) {
            product.stock -= orderItem.quantity;
            await product.save({ session });
          }
        }

        // Clear user's cart
        const cart = await Cart.findOne({ userId: order.userInfo.userId }).session(session);
        if (cart) {
          cart.items = [];
          await cart.save({ session });
        }
      } else {
        order.paymentStatus = 'FAILED';
        order.orderStatus = 'CANCELLED';
      }
    }

    await order.save({ session });
    await session.commitTransaction();

    const populatedOrder = await Order.findById(order._id)
      .populate('items.product', 'name price mainImage');

    res.json({
      message: order.paymentStatus === 'PAID' ? 'Payment successful' : 'Payment failed',
      order: populatedOrder,
      paymentDetails: paymentResponse
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('eSewa success handler error:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

export const handleEsewaFailure = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { transaction_uuid } = req.query;

    console.log('eSewa payment failure:', req.query);

    if (transaction_uuid) {
      const order = await Order.findOne({ esewaTransactionUuid: transaction_uuid });
      if (order) {
        order.paymentStatus = 'FAILED';
        order.orderStatus = 'CANCELLED';
        await order.save();
      }
    }

    res.json({ 
      message: 'Payment cancelled or failed',
      transaction_uuid,
      status: 'FAILED'
    });
  } catch (error) {
    console.error('eSewa failure handler error:', error);
    next(error);
  }
};

// Updated order status logic
export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { orderStatus } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED'];
    
    if (!validStatuses.includes(orderStatus)) {
      res.status(400).json({ message: 'Invalid order status' });
      return;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Update order status
    order.orderStatus = orderStatus;

    // For COD orders, update payment status when delivered
    if (order.paymentMethod === 'CASH_ON_DELIVERY' && orderStatus === 'DELIVERED') {
      order.paymentStatus = 'PAID';
    }

    // If order is cancelled and payment was pending, mark as failed
    if (orderStatus === 'CANCELLED' && order.paymentStatus === 'PENDING') {
      order.paymentStatus = 'FAILED';
    }

    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('items.product', 'name price mainImage');

    res.json({
      message: 'Order status updated successfully',
      order: populatedOrder
    });

  } catch (error) {
    console.error('Update order status error:', error);
    next(error);
  }
};

// Check payment status
export const checkPaymentStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    if (order.paymentMethod === 'ESEWA' && order.esewaTransactionUuid) {
      try {
        const statusResponse = await checkEsewaPaymentStatus(
          ESEWA_CONFIG.MERCHANT_CODE,
          order.grandTotal,
          order.esewaTransactionUuid
        );

        // Update order based on eSewa status
        switch (statusResponse.status) {
          case 'COMPLETE':
            order.paymentStatus = 'PAID';
            order.orderStatus = 'CONFIRMED';
            order.esewaRefId = statusResponse.ref_id;
            break;
          case 'PENDING':
            order.paymentStatus = 'PENDING';
            break;
          case 'CANCELED':
          case 'NOT_FOUND':
            order.paymentStatus = 'FAILED';
            order.orderStatus = 'CANCELLED';
            break;
        }

        await order.save();
        
        res.json({
          message: 'Payment status checked',
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          esewaStatus: statusResponse
        });

      } catch (error) {
        res.json({
          message: 'Unable to check payment status',
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus
        });
      }
    } else {
      res.json({
        message: 'Payment status retrieved',
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus
      });
    }

  } catch (error) {
    console.error('Check payment status error:', error);
    next(error);
  }
};

// Keep other functions unchanged
export const createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      userInfo, 
      items, 
      deliveryAddress, 
      paymentMethod, 
      taxAmount = 0, 
      deliveryCharge = 0, 
      notes 
    } = req.body;

    if (!userInfo || !userInfo.userId || !userInfo.username) {
      res.status(400).json({ message: 'User info (ID and username) is required' });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'Items are required' });
      return;
    }

    if (!deliveryAddress || !deliveryAddress.fullName || !deliveryAddress.phoneNumber || !deliveryAddress.address || !deliveryAddress.city) {
      res.status(400).json({ message: 'Complete delivery address is required' });
      return;
    }

    if (!['CASH_ON_DELIVERY', 'ESEWA'].includes(paymentMethod)) {
      res.status(400).json({ message: 'Invalid payment method' });
      return;
    }

    let totalAmount = 0;
    const validatedItems: IOrderItem[] = [];

    for (const item of items) {
      if (!item.product || !item.quantity || item.quantity < 1) {
        res.status(400).json({ message: 'Invalid item data' });
        return;
      }

      const product = await Product.findById(item.product).session(session) as IProduct | null;
      if (!product) {
        res.status(400).json({ message: `Product not found: ${item.product}` });
        return;
      }

      if (product.stock < item.quantity) {
        res.status(400).json({ message: `Insufficient stock for product: ${product.name}` });
        return;
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      validatedItems.push({
        product: product._id as mongoose.Types.ObjectId,
        quantity: item.quantity,
        price: product.price
      });
    }

    const grandTotal = totalAmount + taxAmount + deliveryCharge;

    const orderData: Partial<IOrder> = {
      userInfo,
      items: validatedItems,
      deliveryAddress,
      paymentMethod,
      totalAmount,
      taxAmount,
      deliveryCharge,
      grandTotal,
      notes,
      paymentStatus: paymentMethod === 'CASH_ON_DELIVERY' ? 'PENDING' : 'PENDING',
      orderStatus: paymentMethod === 'CASH_ON_DELIVERY' ? 'CONFIRMED' : 'PENDING'
    };

    if (paymentMethod === 'ESEWA') {
      orderData.esewaTransactionUuid = generateTransactionUuid();
    }

    const order = new Order(orderData);
    await order.save({ session });

    // For COD, reduce stock immediately
    if (paymentMethod === 'CASH_ON_DELIVERY') {
      for (const item of items) {
        const product = await Product.findById(item.product).session(session);
        if (product) {
          product.stock -= item.quantity;
          await product.save({ session });
        }
      }
    }

    await session.commitTransaction();

    const populatedOrder = await Order.findById(order._id)
      .populate('items.product', 'name price mainImage');

    if (paymentMethod === 'ESEWA') {
      const paymentData = prepareEsewaPaymentData(
        totalAmount,
        taxAmount,
        deliveryCharge,
        order.esewaTransactionUuid!
      );

      res.status(201).json({
        message: 'Order created successfully',
        order: populatedOrder,
        paymentData,
        instructions: {
          message: 'To complete payment, submit a POST request to the gateway_url with the payment form data',
          method: 'POST',
          url: paymentData.gateway_url,
          formData: {
            amount: paymentData.amount,
            tax_amount: paymentData.tax_amount,
            total_amount: paymentData.total_amount,
            transaction_uuid: paymentData.transaction_uuid,
            product_code: paymentData.product_code,
            product_service_charge: paymentData.product_service_charge,
            product_delivery_charge: paymentData.product_delivery_charge,
            success_url: paymentData.success_url,
            failure_url: paymentData.failure_url,
            signed_field_names: paymentData.signed_field_names,
            signature: paymentData.signature
          }
        }
      });
      return;
    }

    res.status(201).json({
      message: 'Order created successfully',
      order: populatedOrder
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Create order error:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

export const getOrdersByUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    if (!userId) {
      res.status(400).json({ message: 'User ID is required' });
      return;
    }

    const [orders, total] = await Promise.all([
      Order.find({ 'userInfo.userId': userId })
        .populate('items.product', 'name price mainImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ 'userInfo.userId': userId })
    ]);

    res.json({
      orders,
      total,
      page,
      pages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Get user orders error:', error);
    next(error);
  }
};

export const getAllOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const filter = status ? { orderStatus: status } : {};

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('items.product', 'name price mainImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter)
    ]);

    res.json({
      orders,
      total,
      page,
      pages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Get all orders error:', error);
    next(error);
  }
};

export const getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('items.product', 'name price mainImage description');

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    res.json({ order });

  } catch (error) {
    console.error('Get order by ID error:', error);
    next(error);
  }
};

export const getOrderStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ message: 'User ID is required' });
      return;
    }

    const [totalOrders, pendingOrders, confirmedOrders, deliveredOrders, totalSpent] = await Promise.all([
      Order.countDocuments({ 'userInfo.userId': userId }),
      Order.countDocuments({ 'userInfo.userId': userId, orderStatus: 'PENDING' }),
      Order.countDocuments({ 'userInfo.userId': userId, orderStatus: 'CONFIRMED' }),
      Order.countDocuments({ 'userInfo.userId': userId, orderStatus: 'DELIVERED' }),
      Order.aggregate([
        { $match: { 'userInfo.userId': userId, paymentStatus: 'PAID' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ])
    ]);

    res.json({
      totalOrders,
      pendingOrders,
      confirmedOrders,
      deliveredOrders,
      totalSpent: totalSpent[0]?.total || 0
    });

  } catch (error) {
    console.error('Get order stats error:', error);
    next(error);
  }
};