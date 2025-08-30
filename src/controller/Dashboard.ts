import { Request, Response } from "express";
import Product from "../model/Product";
import Category from "../model/Category";
import User from "../model/User";
import Order from "../model/Order";

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get total counts
    const [
      totalProducts,
      totalCategories,
      totalUsers,
      totalOrders
    ] = await Promise.all([
      Product.countDocuments(),
      Category.countDocuments(),
      User.countDocuments(),
      Order.countDocuments()
    ]);

    // Get order stats by payment method
    const paymentMethodStats = await Order.aggregate([
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 }
        }
      }
    ]);

    // Get monthly order stats for the current year
    const currentYear = new Date().getFullYear();
    const monthlyOrders = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ]);

    // Get highest selling products
    const highestSellingProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.quantity" }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 }, // Reduced to 5 for better UI
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      {
        $unwind: "$productDetails"
      },
      {
        $project: {
          productId: "$_id",
          productName: "$productDetails.name",
          totalSold: 1,
          price: "$productDetails.price",
          mainImage: "$productDetails.mainImage"
        }
      }
    ]);

    // Format monthly orders data for line graph
    const monthlyOrdersData = Array(12).fill(0);
    monthlyOrders.forEach(item => {
      monthlyOrdersData[item._id - 1] = item.count;
    });

    // Format payment method data for pie chart
    const paymentMethodData = paymentMethodStats.map(item => ({
      name: item._id || 'Unknown',
      value: item.count
    }));

    res.status(200).json({
      totals: {
        products: totalProducts,
        categories: totalCategories,
        users: totalUsers,
        orders: totalOrders
      },
      charts: {
        monthlyOrders: monthlyOrdersData,
        paymentMethods: paymentMethodData
      },
      highestSellingProducts
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: "Error fetching dashboard statistics" });
  }
};

export const getDashboardStatsByTimeRange = async (req: Request, res: Response): Promise<void> => {
  try {
    const { range } = req.params;
    
    let startDate: Date;
    let endDate: Date = new Date();
    
    // Handle monthly ranges
    if (['january', 'february', 'march', 'april', 'may', 'june', 
         'july', 'august', 'september', 'october', 'november', 'december'].includes(range)) {
      const monthIndex = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
      ].indexOf(range);
      
      const currentYear = new Date().getFullYear();
      startDate = new Date(currentYear, monthIndex, 1);
      endDate = new Date(currentYear, monthIndex + 1, 0); // Last day of the month
    } else if (range === 'yearly') {
      const currentYear = new Date().getFullYear();
      startDate = new Date(currentYear, 0, 1); // January 1st
      endDate = new Date(currentYear, 11, 31); // December 31st
    } else {
      // Default to current month if invalid range
      const currentDate = new Date();
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    }
    
    // Get orders within the time range
    const ordersInRange = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    // Calculate revenue
    const revenue = ordersInRange.reduce((total, order) => total + (order.grandTotal || 0), 0);
    
    // Get new users in range
    const newUsers = await User.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    // Get new products in range
    const newProducts = await Product.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    res.status(200).json({
      range,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      revenue: Math.round(revenue * 100) / 100, // Round to 2 decimal places
      orders: ordersInRange.length,
      newUsers,
      newProducts
    });
  } catch (error) {
    console.error('Error fetching time range stats:', error);
    res.status(500).json({ error: "Error fetching time range statistics" });
  }
};