require('dotenv').config();
const path = require("path");
const fs = require('fs');

const errorController = require("./controllers/error");
const sequelize = require("./util/database");
const Product = require("./models/product");
const User = require("./models/user");
const Cart = require("./models/cart");
const CartItem = require("./models/cart-item");
const Order = require("./models/order");
const OrderItem = require("./models/order-item");
const Category = require("./models/category");
const SubCategory = require("./models/subcategory");

const compression = require('compression');
const morgan = require('morgan');

const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();

app.set("view engine", "ejs");
app.set("views", "views");

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'})

app.use(compression());
app.use(morgan('combined', {stream: accessLogStream}));

app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
app.use(express.static(path.join(__dirname, "public")));app.set('trust proxy', 1);

// Session Middleware
app.use(
  session({
    secret: "onecommerce_secret_session_key_987",
    resave: true,
    saveUninitialized: true,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: false,
      httpOnly: true
    }
  })
);

const Setting = require("./models/setting");

app.use((req, res, next) => {
  // Timeout safety: if middleware takes > 8 seconds, skip and continue
  let done = false;
  const timer = setTimeout(() => {
    if (!done) {
      done = true;
      console.error("⚠️ Middleware timeout (8s) for:", req.url);
      res.locals.siteSettings = res.locals.siteSettings || {};
      res.locals.cartCount = res.locals.cartCount || 0;
      res.locals.globalCategories = res.locals.globalCategories || [];
      next();
    }
  }, 8000);

  (async () => {
    try {
      console.log("📥 Request:", req.method, req.url);

      if (req.session && (req.session.userId || (req.session.user && req.session.user.id))) {
        const uId = req.session.userId || req.session.user.id;
        req.user = await User.findByPk(uId).catch(() => null);
      } else {
        req.user = null;
      }

      let setting = await Setting.findOne().catch(() => null);
      if (!setting) {
        setting = await Setting.create({}).catch(() => null);
      }
      const adminController = require("./controllers/admin");
      const footerConfig = adminController.loadFooterConfig();
      const siteSettings = setting ? setting.get({ plain: true }) : {};
      siteSettings.developer_name = footerConfig.developer_name || 'OneHost BD';
      siteSettings.language = siteSettings.language || 'bn';
      res.locals.siteSettings = siteSettings;

      // Global Translation Helper
      const currentLang = siteSettings.language === 'en' ? 'en' : 'bn';
      const translationDict = {
        en: {
          "Home": "Home", "Categories": "Categories", "Products": "Products", "Hot Deals": "Hot Deals",
          "Track Order": "Track Order", "Cart": "Cart", "Search": "Search", "Search products...": "Search products...",
          "Order Now": "Order Now", "Buy Now": "Buy Now", "Add to Cart": "Add to Cart", "Checkout": "Checkout",
          "Shopping Cart": "Shopping Cart", "Order Summary": "Order Summary", "Subtotal": "Subtotal",
          "Delivery Charge": "Delivery Charge", "Total": "Total", "Inside Dhaka": "Inside Dhaka",
          "Outside Dhaka": "Outside Dhaka", "Billing Details": "Billing Details", "Your Name": "Your Name",
          "Mobile Number": "Mobile Number", "Full Address": "Full Address", "Select Delivery Area": "Select Delivery Area",
          "Confirm Order": "Confirm Order", "Cash on Delivery": "Cash on Delivery", "Online Payment": "Online Payment",
          "Product Details": "Product Details", "Overview": "Overview", "Description": "Description",
          "Stock": "Stock", "In Stock": "In Stock", "Out of Stock": "Out of Stock", "Customer Reviews": "Customer Reviews",
          "Related Products": "Related Products", "Need Help? Call Us:": "Need Help? Call Us:", "Quick Links": "Quick Links",
          "Contact Us": "Contact Us", "All Rights Reserved": "All Rights Reserved",
          "Collection": "Collection", "View All": "View All", "View More": "View More", "All Products": "All Products",
          "Explore Collection": "Explore Collection", "Fast Delivery": "Fast Delivery", "Secure Payment": "Secure Payment",
          "Easy Returns": "Easy Returns", "24/7 Support": "24/7 Support", "Limited Time": "Limited Time",
          "7-day return policy": "7-day return policy", "Nosepin": "Nosepin", "Ring": "Ring",
          "Home Appliances": "Home Appliances", "Health Appliances": "Health Appliances",
          "Thank you! Your order has been placed successfully.": "Thank you! Your order has been placed successfully.",
          "A representative will call you shortly to confirm your order.": "A representative will call you shortly to confirm your order.",
          "Invoice ID": "Invoice ID", "Date": "Date", "Payment Method": "Payment Method",
          "Order Items List": "Order Items List", "Product": "Product", "Quantity": "Quantity", "Price": "Price",
          "Delivery & Customer Info": "Delivery & Customer Info", "Customer Name": "Customer Name",
          "Return to Home": "Return to Home", "No Active Orders": "No Active Orders",
          "Discount": "Discount", "Advance": "Advance", "Free Delivery": "Free Delivery"
        },
        bn: {
          "Home": "হোম", "Categories": "ক্যাটাগরি", "Products": "প্রোডাক্টসমূহ", "Hot Deals": "হট ডিল",
          "Track Order": "অর্ডার ট্র্যাক", "Cart": "কার্ট", "Search": "খুঁজুন", "Search products...": "পণ্য খুঁজুন...",
          "Order Now": "অর্ডার করুন", "Buy Now": "এখনই কিনুন", "Add to Cart": "কার্টে যোগ করুন", "Checkout": "চেকআউট",
          "Shopping Cart": "শপিং কার্ট", "Order Summary": "অর্ডার সামারি", "Subtotal": "সাবটোটাল",
          "Delivery Charge": "ডেলিভারি চার্জ", "Total": "সর্বমোট", "Inside Dhaka": "ঢাকার ভিতরে",
          "Outside Dhaka": "ঢাকার বাইরে", "Billing Details": "বিলিং তথ্য", "Your Name": "আপনার নাম",
          "Mobile Number": "মোবাইল নম্বর", "Full Address": "সম্পূর্ণ ঠিকানা", "Select Delivery Area": "ডেলিভারি এলাকা নির্বাচন করুন",
          "Confirm Order": "অর্ডার নিশ্চিত করুন", "Cash on Delivery": "ক্যাশ অন ডেলিভারি", "Online Payment": "অনলাইন পেমেন্ট",
          "Product Details": "প্রোডাক্টের বিবরণ", "Overview": "ওভারভিউ", "Description": "বিবরণ",
          "Stock": "স্টক", "In Stock": "স্টকে আছে", "Out of Stock": "স্টক শেষ", "Customer Reviews": "গ্রাহকের মতামত",
          "Related Products": "সম্পর্কিত প্রোডাক্ট", "Need Help? Call Us:": "প্রয়োজনে কল করুন:", "Quick Links": "গুরুত্বপূর্ণ লিংক",
          "Contact Us": "যোগাযোগ", "All Rights Reserved": "সর্বস্বত্ব সংরক্ষিত",
          "Collection": "কালেকশন", "View All": "সব দেখুন", "View More": "আরও দেখুন", "All Products": "সকল প্রোডাক্ট",
          "Explore Collection": "কালেকশন ব্রাউজ করুন", "Fast Delivery": "দ্রুত ডেলিভারি", "Secure Payment": "নিরাপদ পেমেন্ট",
          "Easy Returns": "সহজ রিটার্ন", "24/7 Support": "২৪/৭ সাপোর্ট", "Limited Time": "সীমিত সময়ের অফার",
          "7-day return policy": "৭ দিনের রিটার্ন গ্যারান্টি", "Nosepin": "নোসপিন", "Ring": "আংটি / রিং",
          "Home Appliances": "হোম অ্যাপ্লায়েন্স", "Health Appliances": "হেলথ অ্যাপ্লায়েন্স",
          "Thank you! Your order has been placed successfully.": "ধন্যবাদ! আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে।",
          "A representative will call you shortly to confirm your order.": "কিছুক্ষনের মধ্যে আমাদের একজন প্রতিনিধি আপনার নাম্বারে কল করে অর্ডারটি কনফার্ম করবেন।",
          "Invoice ID": "ইনভয়েস আইডি", "Date": "তারিখ", "Payment Method": "পেমেন্ট মেথড",
          "Order Items List": "অর্ডারের পণ্যের তালিকা", "Product": "পণ্য", "Quantity": "পরিমাণ", "Price": "মূল্য",
          "Delivery & Customer Info": "ডেলিভারি ও কাস্টমার ইনফরমেশন", "Customer Name": "কাস্টমারের নাম",
          "Return to Home": "হোম পেজে ফিরে যান", "No Active Orders": "আপনার কোনো সক্রিয় অর্ডার নেই!",
          "Discount": "ডিসকাউন্ট", "Advance": "এডভান্স", "Free Delivery": "ফ্রি ডেলিভারি"
        }
      };
      res.locals.__ = (key) => {
        if (translationDict[currentLang] && translationDict[currentLang][key]) {
          return translationDict[currentLang][key];
        }
        return key;
      };

      // Global Dynamic API Integration Configurations
      const paymentConfig = adminController.loadPaymentConfig();
      res.locals.bkashConfig = paymentConfig.bkash;
      res.locals.shurjopayConfig = paymentConfig.shurjopay;

      const smsConfig = adminController.loadSmsConfig();
      res.locals.smsConfig = smsConfig;
      
      const courierConfig = adminController.loadCourierConfig();
      res.locals.steadfastConfig = courierConfig.steadfast;
      res.locals.pathaoConfig = courierConfig.pathao;
      res.locals.gtmConfig = adminController.loadGtmConfig();
      res.locals.pixelConfig = adminController.loadPixelConfig();

      // Fetch dynamic categories safely with fallback
      try {
        const categories = await Category.findAll({
          where: { status: true },
          include: [{ model: SubCategory, required: false }],
          order: [['order', 'ASC'], ['id', 'ASC']]
        });
        const isBannerCategory = (name) => {
          if (!name) return true;
          const lower = name.trim().toLowerCase();
          return lower.includes('banner') || lower.includes('slider') || lower.includes('promo') || lower.includes('popup');
        };
        res.locals.globalCategories = (categories || []).filter(c => !isBannerCategory(c.name));
      } catch (catErr) {
        console.log("Error loading global categories:", catErr.message);
        res.locals.globalCategories = [];
      }

      // Cart Count (Direct & safe query on CartItem table)
      res.locals.cartCount = 0;
      if (req.user && typeof req.user.getCart === 'function') {
        try {
          const cart = await req.user.getCart().catch(() => null);
          if (cart) {
            const CartItem = require('./models/cart-item');
            const items = await CartItem.findAll({ where: { cartId: cart.id } }).catch(() => []);
            res.locals.cartCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
          }
        } catch (cartErr) {
          console.log("Error calculating cart count:", cartErr.message);
          res.locals.cartCount = 0;
        }
      }

      // Dynamic Pending Orders Count for Admin Sidebar & Bell Notification Badges
      res.locals.pendingOrdersCount = 0;
      try {
        const Order = require('./models/order');
        const { Op } = require('sequelize');
        res.locals.pendingOrdersCount = await Order.count({
          where: {
            status: { [Op.in]: ['Pending', 'pending'] }
          }
        }).catch(() => 0);
      } catch (ordErr) {
        res.locals.pendingOrdersCount = 0;
      }
    } catch (error) {
      console.log("Error in App.js middleware:", error.message);
      res.locals.siteSettings = res.locals.siteSettings || {};
      res.locals.cartCount = 0;
      res.locals.globalCategories = res.locals.globalCategories || [];
    } finally {
      if (!done) {
        done = true;
        clearTimeout(timer);
        next();
      }
    }
  })();
});

app.use("/admin", adminRoutes);
app.use(shopRoutes);

app.use(errorController.get404);

// Global Server Error Logging Middleware
app.use((err, req, res, next) => {
  console.error("🔥 [EXPRESS SERVER ERROR]:", err.stack || err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).send(`
    <div style="font-family: sans-serif; padding: 30px; background: #fff1f2; color: #9f1239; border-radius: 12px; margin: 50px auto; max-width: 800px; border: 1px solid #fecdd3;">
      <h2 style="margin-top:0;">⚠️ Live Server Error Occurred</h2>
      <p><b>Error Message:</b> ${err.message || err}</p>
      <pre style="background: #ffffff; padding: 15px; border-radius: 8px; overflow-x: auto; color: #475569; font-size: 13px;">${err.stack || ''}</pre>
    </div>
  `);
});

// Model Associations
Product.belongsTo(User, { constraints: true, onDelete: "CASCADE" });
User.hasMany(Product);

User.hasOne(Cart);
Cart.belongsTo(User);

Cart.belongsToMany(Product, { through: CartItem });
Product.belongsToMany(Cart, { through: CartItem });

Order.belongsTo(User);
User.hasMany(Order);

Order.belongsToMany(Product, { through: OrderItem });

Category.hasMany(SubCategory, { foreignKey: 'categoryId', onDelete: "CASCADE" });
SubCategory.belongsTo(Category, { foreignKey: 'categoryId' });

// Sync database and seed data
sequelize
  .sync()
  .then((result) => {
    sequelize.query("ALTER TABLE products CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;").catch(e => console.log("products table alter utf8mb4 info:", e.message));
    sequelize.query("ALTER TABLE orders CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;").catch(e => {});
    sequelize.query("ALTER TABLE order_items CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;").catch(e => {});
    sequelize.query("ALTER TABLE orderItems CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;").catch(e => {});
    sequelize.query("ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;").catch(e => {});
    sequelize.query("ALTER TABLE settings CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;").catch(e => {});
    sequelize.query("ALTER TABLE categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;").catch(e => {});
    sequelize.query("ALTER TABLE products ADD COLUMN subCategory VARCHAR(255) NULL;").catch(e => {});
    sequelize.query("ALTER TABLE products ADD COLUMN isFreeDelivery TINYINT(1) DEFAULT 0;").catch(e => {});
    sequelize.query("ALTER TABLE products ADD COLUMN stock INT DEFAULT 50;").catch(e => {});
    sequelize.query("ALTER TABLE products ADD COLUMN purchasePrice DOUBLE DEFAULT 0;").catch(e => {});
    sequelize.query("ALTER TABLE settings ADD COLUMN language VARCHAR(20) DEFAULT 'bn';").catch(e => {});
    sequelize.query("ALTER TABLE order_items ADD COLUMN price DOUBLE NULL;").catch(e => {});
    sequelize.query("ALTER TABLE orderItems ADD COLUMN price DOUBLE NULL;").catch(e => {});
    sequelize.query("ALTER TABLE orders ADD COLUMN userId INT NULL;").catch(e => {});
    sequelize.query("ALTER TABLE orders ADD COLUMN adminNote TEXT NULL;").catch(e => {});
    sequelize.query("ALTER TABLE orders ADD COLUMN assignee VARCHAR(255) DEFAULT 'Super Admin';").catch(e => {});
    sequelize.query("ALTER TABLE orders ADD COLUMN shippingCharge DOUBLE DEFAULT 60;").catch(e => {});
    // Seed default categories if empty
    return Category.count().then(count => {
      if (count === 0) {
        return Category.bulkCreate([
          { name: "Nosepin", slug: "nosepin", image: "https://www.onecommercebd.com/uploads/category/thumb/1787182103-Nosepin.jpg", status: true, order: 1 },
          { name: "Ring", slug: "ring", image: "https://www.onecommercebd.com/uploads/category/thumb/1787182061-Ring.png", status: true, order: 2 },
          { name: "Home Appliances", slug: "home-appliances", image: "https://www.onecommercebd.com/uploads/category/thumb/1787182036-home-app.png", status: true, order: 3 },
          { name: "Health Appliances", slug: "health-appliances", image: "https://www.onecommercebd.com/uploads/category/thumb/1787181977-beauty.jpg", status: true, order: 4 }
        ]);
      }
    }).then(() => User.findByPk(1));
  })
  .then((user) => {
    if (!user) {
      return User.create({ name: "Lahiru", email: "lahirurc1st@gmail.com" });
    }
    return user;
  })
  .then((user) => {
    return user.getCart().then(cart => {
      if (!cart) {
        return user.createCart();
      }
      return cart;
    });
  })
  .then(cart => { 
    // Only call app.listen() when running directly (not under cPanel Passenger/lsnode)
    if (!module.parent) {
      const port = process.env.PORT || 3000;
      app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
      });
    } else {
      console.log("Running under Passenger (lsnode), skipping app.listen()");
    }
  })
  .catch((error) => console.log("APP error:", error));

// Export app for cPanel Passenger (lsnode.js requires this)
module.exports = app;
