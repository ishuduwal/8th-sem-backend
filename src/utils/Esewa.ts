import crypto from 'crypto';
import axios from 'axios';

export const ESEWA_CONFIG = {
  MERCHANT_CODE: process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST',
  SECRET_KEY: process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q',
  GATEWAY_URL: process.env.NODE_ENV === 'production' 
    ? 'https://epay.esewa.com.np/api/epay/main/v2/form'
    : 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
  STATUS_CHECK_URL: process.env.NODE_ENV === 'production'
    ? 'https://epay.esewa.com.np/api/epay/transaction/status/'
    : 'https://rc-epay.esewa.com.np/api/epay/transaction/status/',
  SUCCESS_URL: process.env.ESEWA_SUCCESS_URL || 'http://localhost:5000/api/order/esewa/success',
  FAILURE_URL: process.env.ESEWA_FAILURE_URL || 'http://localhost:5000/api/order/esewa/failure'
};

export const generateEsewaSignature = (
  totalAmount: number,
  transactionUuid: string,
  productCode: string = ESEWA_CONFIG.MERCHANT_CODE
): string => {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const hash = crypto.createHmac('sha256', ESEWA_CONFIG.SECRET_KEY)
    .update(message)
    .digest('base64');
  return hash;
};


export const verifyEsewaSignature = (
  transactionCode: string,
  status: string,
  totalAmount: string,
  transactionUuid: string,
  productCode: string,
  signedFieldNames: string,
  receivedSignature: string
): boolean => {
  try {
    
    const message = `transaction_code=${transactionCode},status=${status},total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode},signed_field_names=${signedFieldNames}`;
    
    const secretKey = ESEWA_CONFIG.SECRET_KEY.trim();
    const expectedSignature = crypto.createHmac('sha256', secretKey)
      .update(message)
      .digest('base64');

    console.log('Signature Verification Debug:', {
      inputMessage: message,
      generatedSignature: expectedSignature,
      receivedSignature: receivedSignature,
      signaturesMatch: expectedSignature === receivedSignature
    });
    
    return expectedSignature === receivedSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};


export const generateTransactionUuid = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TXN-${timestamp}-${random}`;
};


export const checkEsewaPaymentStatus = async (
  productCode: string,
  totalAmount: number,
  transactionUuid: string
): Promise<any> => {
  try {
    const url = `${ESEWA_CONFIG.STATUS_CHECK_URL}?product_code=${productCode}&total_amount=${totalAmount}&transaction_uuid=${transactionUuid}`;
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error: any) {
    console.error('eSewa status check error:', error.response?.data || error.message);
    throw new Error('Failed to check payment status');
  }
};

export const prepareEsewaPaymentData = (
  amount: number,
  taxAmount: number,
  deliveryCharge: number,
  transactionUuid: string,
  productCode: string = ESEWA_CONFIG.MERCHANT_CODE
) => {
  const totalAmount = amount + taxAmount + deliveryCharge;
  const signature = generateEsewaSignature(totalAmount, transactionUuid, productCode);

  return {
    amount: amount.toString(),
    tax_amount: taxAmount.toString(),
    total_amount: totalAmount.toString(),
    transaction_uuid: transactionUuid,
    product_code: productCode,
    product_service_charge: '0',
    product_delivery_charge: deliveryCharge.toString(),
    success_url: ESEWA_CONFIG.SUCCESS_URL,
    failure_url: ESEWA_CONFIG.FAILURE_URL,
    signed_field_names: 'total_amount,transaction_uuid,product_code',
    signature,
    // gateway for frontend
    gateway_url: ESEWA_CONFIG.GATEWAY_URL
  };
};

// Decode base64 response from eSewa
export const decodeEsewaResponse = (encodedData: string) => {
  try {
    // Decode base64
    const decodedString = Buffer.from(encodedData, 'base64').toString('utf-8');
    
    const response = JSON.parse(decodedString);
    
    return response;
  } catch (error) {
    console.error('Error decoding eSewa response:', error);
    throw new Error('Invalid eSewa response format');
  }
};