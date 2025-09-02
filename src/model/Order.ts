import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
}

export interface IDeliveryAddress {
  fullName: string;
  phoneNumber: string;
  address: string;
  city: string;
  postalCode?: string;
}

export interface IUserInfo {
  userId: string;
  username: string; // Only userId and username are needed
}

export interface IOrder extends Document {
  _id: string;
  userInfo: IUserInfo;
  items: IOrderItem[];
  deliveryAddress: IDeliveryAddress;
  paymentMethod: 'CASH_ON_DELIVERY' | 'ESEWA';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
  orderStatus: 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  taxAmount: number;
  deliveryCharge: number;
  grandTotal: number;
  
  // eSewa specific fields
  esewaTransactionUuid?: string;
  esewaTransactionCode?: string;
  esewaRefId?: string;
  esewaSignature?: string;
  
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema: Schema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  }
});

const DeliveryAddressSchema: Schema = new Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  postalCode: {
    type: String,
    trim: true
  }
});

const UserInfoSchema: Schema = new Schema({
  userId: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    trim: true
  }
  // REMOVED email field
});

const OrderSchema: Schema = new Schema({
  userInfo: {
    type: UserInfoSchema,
    required: true
  },
  items: {
    type: [OrderItemSchema],
    required: true,
    validate: {
      validator: function(items: IOrderItem[]) {
        return items && items.length > 0;
      },
      message: 'Order must have at least one item'
    }
  },
  deliveryAddress: {
    type: DeliveryAddressSchema,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['CASH_ON_DELIVERY', 'ESEWA'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED'],
    default: 'PENDING'
  },
  orderStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING'
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  deliveryCharge: {
    type: Number,
    default: 0,
    min: 0
  },
  grandTotal: {
    type: Number,
    required: true,
    min: 0
  },
  
  // eSewa specific fields
  esewaTransactionUuid: {
    type: String,
    sparse: true
  },
  esewaTransactionCode: {
    type: String,
    sparse: true
  },
  esewaRefId: {
    type: String,
    sparse: true
  },
  esewaSignature: {
    type: String,
    sparse: true
  },
  
  notes: {
    type: String,
    trim: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

OrderSchema.index({ 'userInfo.userId': 1, createdAt: -1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ paymentStatus: 1 });

export default mongoose.model<IOrder>('Order', OrderSchema);