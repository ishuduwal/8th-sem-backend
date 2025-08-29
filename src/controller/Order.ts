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
      userEmail,
      deliveryAddress, 
      paymentMethod, 
      taxAmount = 0, 
      deliveryCharge = 0, 
      notes 
    } = req.body;

    // Validation
    if (!userEmail) {
      await session.abortTransaction();
      res.status(400).json({ message: 'User email is required' });
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
    const cart = await Cart.findOne({ userEmail }).session(session);
    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      res.status(400).json({ message: 'Cart is empty' });
      return;
    }

    // Validate cart items and check stock
    let totalAmount = 0;
    const validatedItems: IOrderItem[] = [];
    const stockUpdates: {productId: mongoose.Types.ObjectId, newStock: number}[] = [];

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

      // Reduce product stock
      product.stock -= cartItem.quantity;
      await product.save({ session });
      
      // Record stock update for potential rollback
      stockUpdates.push({
        productId: product._id as mongoose.Types.ObjectId,
        newStock: product.stock
      });

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
        email: userEmail,
        username: userEmail.split('@')[0] // Extract username from email
      },
      items: validatedItems,
      deliveryAddress,
      paymentMethod,
      totalAmount,
      taxAmount,
      deliveryCharge,
      grandTotal,
      notes,
      paymentStatus: 'PENDING'
    };

    // Add eSewa transaction UUID if needed
    if (paymentMethod === 'ESEWA') {
      orderData.esewaTransactionUuid = generateTransactionUuid();
    }

    const order = new Order(orderData);
    await order.save({ session });

    // Clear cart after successful order creation
    cart.items = [];
    await cart.save({ session });

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
        message: 'Order created successfully',
        order: populatedOrder,
        paymentData,
        stockUpdates, // Include stock updates in response for debugging
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
      order: populatedOrder,
      stockUpdates // Include stock updates in response for debugging
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create order from cart error:', error);
    next(error);
  }
};

// Keep the original createOrder for backward compatibility if needed
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

    
    if (!userInfo || !userInfo.email || !userInfo.username) {
      res.status(400).json({ message: 'User info (email and username) is required' });
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

      
      product.stock -= item.quantity;
      await product.save({ session });

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
      paymentStatus: 'PENDING'
    };

    
    if (paymentMethod === 'ESEWA') {
      orderData.esewaTransactionUuid = generateTransactionUuid();
    }

    const order = new Order(orderData);
    await order.save({ session });

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

export const handleEsewaSuccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      res.status(400).json({ message: 'Invalid payment signature' });
      return;
    }

    
    const order = await Order.findOne({ esewaTransactionUuid: transaction_uuid });
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    
    try {
      const statusResponse = await checkEsewaPaymentStatus(
        product_code,
        parseInt(total_amount),
        transaction_uuid
      );

      console.log('eSewa status check response:', statusResponse);

      if (status === 'COMPLETE' && statusResponse.status === 'COMPLETE') {
        order.paymentStatus = 'PAID';
        order.orderStatus = 'CONFIRMED';
        order.esewaTransactionCode = transaction_code;
        order.esewaRefId = statusResponse.ref_id;
        order.esewaSignature = signature;
      } else {
        order.paymentStatus = 'FAILED';
      }

    } catch (statusError) {
      console.error('Status check failed:', statusError);
      // If status check fails but signature is valid, still update order
      if (status === 'COMPLETE') {
        order.paymentStatus = 'PAID';
        order.orderStatus = 'CONFIRMED';
        order.esewaTransactionCode = transaction_code;
        order.esewaSignature = signature;
      } else {
        order.paymentStatus = 'FAILED';
      }
    }

    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('items.product', 'name price mainImage');

    res.json({
      message: order.paymentStatus === 'PAID' ? 'Payment successful' : 'Payment failed',
      order: populatedOrder,
      paymentDetails: paymentResponse
    });

  } catch (error) {
    console.error('eSewa success handler error:', error);
    next(error);
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
        await order.save();
      }
    }

    res.json({ 
      message: 'Payment cancelled or failed',
      transaction_uuid
    });
  } catch (error) {
    console.error('eSewa failure handler error:', error);
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

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { orderStatus } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED'];
    
    if (!validStatuses.includes(orderStatus)) {
      res.status(400).json({ message: 'Invalid order status' });
      return;
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { orderStatus },
      { new: true, runValidators: true }
    ).populate('items.product', 'name price mainImage');

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    res.json({
      message: 'Order status updated successfully',
      order
    });

  } catch (error) {
    console.error('Update order status error:', error);
    next(error);
  }
};

export const getOrdersByUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    if (!email) {
      res.status(400).json({ message: 'User email is required' });
      return;
    }

    const [orders, total] = await Promise.all([
      Order.find({ 'userInfo.email': email })
        .populate('items.product', 'name price mainImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ 'userInfo.email': email })
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
    const { userEmail } = req.params;

    if (!userEmail) {
      res.status(400).json({ message: 'User email is required' });
      return;
    }

    const [totalOrders, pendingOrders, confirmedOrders, deliveredOrders, totalSpent] = await Promise.all([
      Order.countDocuments({ 'userInfo.email': userEmail }),
      Order.countDocuments({ 'userInfo.email': userEmail, orderStatus: 'PENDING' }),
      Order.countDocuments({ 'userInfo.email': userEmail, orderStatus: 'CONFIRMED' }),
      Order.countDocuments({ 'userInfo.email': userEmail, orderStatus: 'DELIVERED' }),
      Order.aggregate([
        { $match: { 'userInfo.email': userEmail, paymentStatus: 'PAID' } },
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
