import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

const ACCESS_TOKEN_EXPIRY = '5m';
const REFRESH_TOKEN_EXPIRY = '1d';

interface TokenPayload {
    userId: string;
    username: string;
    email: string; 
    isAdmin: boolean;
}

export const generateAccessToken = (payload: TokenPayload): string => {
    console.log('JWT payload received:', payload);
    
    return jwt.sign({
        userId: payload.userId,
        username: payload.username,
        email: payload.email,  
        isAdmin: payload.isAdmin
    }, ACCESS_TOKEN_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
    });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
    return jwt.sign({
        userId: payload.userId,
        username: payload.username,
        email: payload.email,  
        isAdmin: payload.isAdmin
    }, REFRESH_TOKEN_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRY,
    });
};

export const verifyAccessToken = (token: string): TokenPayload => {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
};