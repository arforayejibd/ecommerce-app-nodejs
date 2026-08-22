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
    resave: false,
    saveUninitialized: false,
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

      const user = await User.findByPk(1).catch(() => null);
      req.user = user || null;

      let setting = await Setting.findOne().catch(() => null);
      if (!setting) {
        setting = await Setting.create({}).catch(() => null);
      }
      const adminController = require("./controllers/admin");
      const footerConfig = adminController.loadFooterConfig();
      const siteSettings = setting ? setting.get({ plain: true }) : {};
      siteSettings.developer_name = footerConfig.developer_name || 'OneHost BD';
      res.locals.siteSettings = siteSettings;

      // Global Dynamic API Integration Configurations
      res.locals.bkashConfig = req.app.locals.bkashConfig || { username: '01700000000', app_key: 'bkash_app_key_837492810', app_secret: 'bkash_secret_739201948', base_url: 'https://tokenized.pay.bKash.com/v1.2.0-beta', password: 'bkash_password_92841', logo: 'https://raw.githubusercontent.com/tahmid-ul/bkash-logo/main/bkash-logo.png', status: true };
      res.locals.shurjopayConfig = req.app.locals.shurjopayConfig || { base_url: 'https://shurjopay.com', username: 'sp_merchant_user', password: 'sp_password_83749', prefix: 'NO', success_url: 'http://127.0.0.1:3000/payment/shurjopay/success', return_url: 'http://127.0.0.1:3000/payment/shurjopay/cancel', logo: 'https://shurjopay.com/favicon.ico', status: true };
      res.locals.smsConfig = req.app.locals.smsConfig || { url: 'https://api.sms.net.bd/sendsms', api_key: 'sms_net_bd_api_key_83749102', serderid: 'ROSEDRAPE', status: true, order: true, forget_pass: true, password_g: true };
      
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
        res.locals.globalCategories = categories || [];
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
    sequelize.query("ALTER TABLE products ADD COLUMN stock INT DEFAULT 50;").catch(e => {});
    sequelize.query("ALTER TABLE products ADD COLUMN purchasePrice DOUBLE DEFAULT 0;").catch(e => {});
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
