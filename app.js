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
app.use(express.static(path.join(__dirname, "public")));

// Session Middleware
app.use(
  session({
    secret: "onecommerce_secret_session_key_987",
    resave: false,
    saveUninitialized: false,
  })
);

const Setting = require("./models/setting");

app.use((req, res, next) => {
  User.findByPk(1)
    .then((user) => {
      req.user = user;
      return Setting.findOne();
    })
    .then(setting => {
      if (!setting) {
        return Setting.create({});
      }
      return setting;
    })
    .then(setting => {
      res.locals.siteSettings = setting;
      
      // Global Dynamic API Integration Configurations
      res.locals.bkashConfig = req.app.locals.bkashConfig || { username: '01700000000', app_key: 'bkash_app_key_837492810', app_secret: 'bkash_secret_739201948', base_url: 'https://tokenized.pay.bKash.com/v1.2.0-beta', password: 'bkash_password_92841', logo: 'https://raw.githubusercontent.com/tahmid-ul/bkash-logo/main/bkash-logo.png', status: true };
      res.locals.shurjopayConfig = req.app.locals.shurjopayConfig || { base_url: 'https://shurjopay.com', username: 'sp_merchant_user', password: 'sp_password_83749', prefix: 'NO', success_url: 'http://127.0.0.1:3000/payment/shurjopay/success', return_url: 'http://127.0.0.1:3000/payment/shurjopay/cancel', logo: 'https://shurjopay.com/favicon.ico', status: true };
      res.locals.smsConfig = req.app.locals.smsConfig || { url: 'https://api.sms.net.bd/sendsms', api_key: 'sms_net_bd_api_key_83749102', serderid: 'ROSEDRAPE', status: true, order: true, forget_pass: true, password_g: true };
      const adminController = require("./controllers/admin");
      const courierConfig = adminController.loadCourierConfig();
      res.locals.steadfastConfig = courierConfig.steadfast;
      res.locals.pathaoConfig = courierConfig.pathao;
      res.locals.gtmConfig = adminController.loadGtmConfig();
      res.locals.pixelConfig = adminController.loadPixelConfig();

      if (req.user) {
        return req.user.getCart()
          .then(cart => {
            if (!cart) return [];
            return cart.getProducts();
          })
          .then(products => {
            const count = products.reduce((sum, p) => sum + (p.cartItem ? p.cartItem.quantity : 0), 0);
            res.locals.cartCount = count;
            next();
          })
          .catch(err => {
            res.locals.cartCount = 0;
            next();
          });
      } else {
        res.locals.cartCount = 0;
        next();
      }
    })
    .catch((error) => {
      console.log("Error in App.js middleware:", error);
      res.locals.siteSettings = {};
      res.locals.cartCount = 0;
      next();
    });
});

app.use("/admin", adminRoutes);
app.use(shopRoutes);

app.use(errorController.get404);

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

sequelize
  .sync()
  .then((result) => {
    return User.findByPk(1);
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
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((error) => console.log("APP error:", error));
