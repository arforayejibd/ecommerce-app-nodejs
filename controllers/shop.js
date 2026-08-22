const Product = require("../models/product");
const Cart = require("../models/cart");

const ERROR_PREFIX = "In shop controller, ";

const { Op } = require("sequelize");

const safeFindAllProducts = async (whereObj = {}) => {
  try {
    return await Product.findAll({ where: whereObj, order: [['id', 'DESC']] });
  } catch (err) {
    console.log("Fallback safeFindAllProducts:", err.message);
    try {
      return await Product.findAll({
        attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal'],
        where: whereObj,
        order: [['id', 'DESC']]
      });
    } catch (err2) {
      console.log("Secondary fallback safeFindAllProducts failed:", err2.message);
      return [];
    }
  }
};

const safeFindProductById = async (id) => {
  try {
    return await Product.findByPk(id);
  } catch (err) {
    console.log("Fallback safeFindProductById for id:", id, err.message);
    try {
      return await Product.findByPk(id, {
        attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal']
      });
    } catch (err2) {
      console.log("Secondary fallback safeFindProductById failed:", err2.message);
      return null;
    }
  }
};

exports.getProducts = async (req, res, next) => {
  try {
    const category = req.query.category;
    const subcategory = req.query.subcategory;
    const search = req.query.search;
    let whereCondition = {};

    if (category && category !== "All") {
      whereCondition.category = category;
    }
    if (search) {
      whereCondition.title = { [Op.like]: `%${search}%` };
    }

    const products = await safeFindAllProducts(whereCondition);

    let categories = [];
    try {
      const catResults = await Product.findAll({
        attributes: ['category'],
        group: ['category']
      });
      categories = catResults.map(c => c.category).filter(Boolean);
    } catch (e) {
      categories = Array.from(new Set((products || []).map(p => p.category).filter(Boolean)));
    }

    res.render("shop/product-list", {
      prods: products,
      pageTitle: subcategory ? `${subcategory} - Products` : (category ? `${category} - Products` : "All Products"),
      path: "/products",
      hasProducts: (products || []).length > 0,
      categories: categories,
      selectedCategory: category || "All",
      selectedSubCategory: subcategory || "",
      searchQuery: search || ""
    });
  } catch (error) {
    console.log("In shop controller, getProducts: ", error);
    res.render("shop/product-list", {
      prods: [],
      pageTitle: "Products",
      path: "/products",
      hasProducts: false,
      categories: [],
      selectedCategory: "All",
      selectedSubCategory: "",
      searchQuery: ""
    });
  }
};

exports.getProduct = async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const product = await safeFindProductById(productId);
    if (!product) {
      return res.redirect("/products");
    }

    const allProducts = await safeFindAllProducts();
    const related = (allProducts || []).filter(p => p.id !== product.id).slice(0, 4);

    res.render("shop/product-detail", {
      product: product,
      relatedProducts: related,
      pageTitle: product.title,
      path: "/products",
    });
  } catch (error) {
    console.log("Error in getProduct: ", error);
    res.redirect("/products");
  }
};

const path = require("path");
const fs = require("fs");

const getBannersFilePath = () => path.join(__dirname, "..", "util", "banners.json");

const loadBanners = () => {
  try {
    const file = getBannersFilePath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.log("Error reading banners.json in shop controller:", err);
  }
  return [];
};

exports.getIndex = async (req, res, next) => {
  try {
    const products = await safeFindAllProducts();
    const hotDeals = (products || []).filter(p => p.isHotDeal === true || p.isHotDeal === 1 || p.isHotDeal === 'true' || p.hotDeal === true);
    
    const categoryMap = {};
    (products || []).forEach(p => {
      const cat = p.category || "General";
      if (!categoryMap[cat]) {
        categoryMap[cat] = [];
      }
      categoryMap[cat].push(p);
    });

    const categoriesList = Object.keys(categoryMap).map(catName => ({
      name: catName,
      img: categoryMap[catName][0] ? categoryMap[catName][0].imageUrl : ''
    }));

    // Filter active banners under 'Main Slider Banner' category
    const allBanners = loadBanners();
    let sliderBanners = allBanners.filter(b => (b.status == 1 || b.status === true || b.status === '1') && (b.category_id == 1 || (b.category_name && b.category_name.toLowerCase().includes('slider'))));
    if (sliderBanners.length === 0) {
      sliderBanners = allBanners.filter(b => b.status == 1 || b.status === true || b.status === '1');
    }

    res.render("shop/index", {
      prods: products,
      hotDeals: hotDeals,
      categoryMap: categoryMap,
      categoriesList: categoriesList,
      sliderBanners: sliderBanners,
      pageTitle: "Home - One Commerce",
      path: "/",
    });
  } catch (error) {
    console.log("In shop controller, getIndex: ", error);
    res.render("shop/index", {
      prods: [],
      hotDeals: [],
      categoryMap: {},
      categoriesList: [],
      sliderBanners: [],
      pageTitle: "Home - One Commerce",
      path: "/",
    });
  }
};

exports.getOrderTrack = (req, res, next) => {
  const orderId = req.query.orderId;
  let trackedOrder = null;
  
  if (orderId) {
    req.user.getOrders({ where: { id: orderId }, include: [{ model: Product }] })
      .then(orders => {
        if (orders.length > 0) {
          trackedOrder = orders[0];
        }
        res.render('shop/order-track', {
          path: '/order-track',
          pageTitle: 'Order Tracking - One Commerce',
          order: trackedOrder,
          orderId: orderId,
          searched: true
        });
      })
      .catch(err => {
        console.log(err);
        res.render('shop/order-track', {
          path: '/order-track',
          pageTitle: 'Order Tracking - One Commerce',
          order: null,
          orderId: orderId,
          searched: true
        });
      });
  } else {
    res.render('shop/order-track', {
      path: '/order-track',
      pageTitle: 'Order Tracking - One Commerce',
      order: null,
      orderId: '',
      searched: false
    });
  }
};

const getUserCart = async (req) => {
  let user = req.user;
  if (!user) {
    const User = require("../models/user");
    user = await User.findByPk(1).catch(() => null);
    if (!user) {
      user = await User.create({ name: "Lahiru", email: "lahirurc1st@gmail.com" }).catch(() => null);
    }
  }
  if (!user) return null;

  let cart = await user.getCart().catch(() => null);
  if (!cart) {
    cart = await user.createCart().catch(() => null);
  }
  return cart;
};

const getCartProducts = async (cart) => {
  if (!cart) return [];
  try {
    return await cart.getProducts();
  } catch (err) {
    console.log("Fallback cart.getProducts:", err.message);
    try {
      return await cart.getProducts({
        attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal']
      });
    } catch (err2) {
      console.log("Secondary fallback cart.getProducts failed:", err2.message);
      return [];
    }
  }
};

exports.getCart = async (req, res, next) => {
  try {
    const cart = await getUserCart(req);
    const products = await getCartProducts(cart);
    
    return res.render("shop/cart", {
      pageTitle: "Cart - One Commerce",
      path: "/cart",
      products: products || [],
    });
  } catch (error) {
    console.log("Error in shop controller getCart:", error);
    return res.render("shop/cart", {
      pageTitle: "Cart - One Commerce",
      path: "/cart",
      products: [],
    });
  }
};

exports.postCart = async (req, res, next) => {
  try {
    const productId = req.body.productId;
    const qty = req.body.quantity ? parseInt(req.body.quantity) : 1;
    const addQty = isNaN(qty) || qty < 1 ? 1 : qty;
    const action = req.body.action;

    if (!productId) {
      return res.redirect("/cart");
    }

    const cart = await getUserCart(req);
    if (!cart) {
      return res.redirect("/cart");
    }

    const CartItem = require("../models/cart-item");
    const existingItem = await CartItem.findOne({
      where: { cartId: cart.id, productId: productId }
    }).catch(() => null);

    if (existingItem) {
      existingItem.quantity = (existingItem.quantity || 1) + addQty;
      await existingItem.save();
    } else {
      await CartItem.create({
        cartId: cart.id,
        productId: productId,
        quantity: addQty
      }).catch(async () => {
        const product = await safeFindProductById(productId);
        if (product && typeof cart.addProduct === 'function') {
          await cart.addProduct(product, { through: { quantity: addQty } });
        }
      });
    }

    const allItems = await CartItem.findAll({ where: { cartId: cart.id } }).catch(() => []);
    const totalCartCount = allItems.reduce((acc, item) => acc + (item.quantity || 1), 0);

    if (req.xhr || (req.headers.accept && req.headers.accept.includes("json"))) {
      return res.json({ success: true, message: "Product added to cart!", cartCount: totalCartCount });
    }

    if (action === "add_to_cart") {
      const backUrl = req.get("Referrer") || `/products/${productId}`;
      return res.redirect(backUrl);
    }

    return res.redirect("/cart");
  } catch (error) {
    console.log("Error in shop controller postCart:", error);
    return res.redirect("/cart");
  }
};

exports.postCartDeleteProduct = async (req, res, next) => {
  try {
    const productId = req.body.productId;
    const cart = await getUserCart(req);
    if (cart && productId) {
      const CartItem = require("../models/cart-item");
      await CartItem.destroy({
        where: { cartId: cart.id, productId: productId }
      }).catch(() => {});
    }
    return res.redirect("/cart");
  } catch (error) {
    console.log("Error in postCartDeleteProduct:", error);
    return res.redirect("/cart");
  }
};

exports.postCartUpdateQty = async (req, res, next) => {
  try {
    const productId = req.body.productId;
    const newQty = parseInt(req.body.quantity);
    
    if (!productId || isNaN(newQty) || newQty < 1) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const cart = await getUserCart(req);
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const CartItem = require("../models/cart-item");
    const item = await CartItem.findOne({
      where: { cartId: cart.id, productId: productId }
    }).catch(() => null);

    if (item) {
      item.quantity = newQty;
      await item.save();
      return res.json({ success: true, message: 'Quantity updated' });
    }
    return res.status(404).json({ success: false, message: 'Product not in cart' });
  } catch (error) {
    console.log("Error in postCartUpdateQty:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const User = require("../models/user");
    const Order = require("../models/order");
    const OrderItem = require("../models/order-item");

    const user = req.user || await User.findByPk(1).catch(() => null);
    if (!user) {
      return res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders - One Commerce',
        orders: []
      });
    }

    let rawOrders = await Order.findAll({
      where: { userId: user.id },
      order: [['createdAt', 'DESC']]
    }).catch(() => []);

    if (!rawOrders || rawOrders.length === 0) {
      rawOrders = await Order.findAll({
        order: [['createdAt', 'DESC']]
      }).catch(() => []);
    }

    const orders = [];
    for (const ord of rawOrders) {
      const ordObj = ord.get ? ord.get({ plain: true }) : ord;
      const items = await OrderItem.findAll({ where: { orderId: ordObj.id } }).catch(() => []);
      const products = [];
      for (const item of items) {
        const prod = await safeFindProductById(item.productId);
        if (prod) {
          const prodObj = prod.get ? prod.get({ plain: true }) : prod;
          prodObj.orderItem = { quantity: item.quantity || 1 };
          products.push(prodObj);
        }
      }
      ordObj.products = products;
      orders.push(ordObj);
    }

    return res.render('shop/orders', {
      path: '/orders',
      pageTitle: 'Your Orders - One Commerce',
      orders: orders
    });
  } catch (err) {
    console.log("Error in getOrders:", err);
    return res.render('shop/orders', {
      path: '/orders',
      pageTitle: 'Your Orders - One Commerce',
      orders: []
    });
  }
};

exports.postOrder = async (req, res, next) => {
  try {
    const { name, phone, address, area, payment_method } = req.body;
    const cart = await getUserCart(req);
    if (!cart) {
      return res.redirect('/cart');
    }

    const products = await getCartProducts(cart);
    if (!products || products.length === 0) {
      return res.redirect('/cart');
    }

    const User = require("../models/user");
    const user = req.user || await User.findByPk(1).catch(() => null);
    const userIdVal = user ? user.id : 1;

    const shippingFee = area ? parseInt(area) : 60;
    let subtotal = 0;
    products.forEach(p => {
      const qty = p.cartItem ? p.cartItem.quantity : 1;
      subtotal += (p.price || 0) * qty;
    });
    const totalAmount = subtotal + (isNaN(shippingFee) ? 60 : shippingFee);
    const invoiceId = 'INV-' + Date.now().toString().slice(-6);

    const Order = require("../models/order");
    const orderData = {
      invoiceId: invoiceId,
      name: name || 'Customer',
      phone: phone || '01700000000',
      address: address || 'Dhaka',
      area: area || '60',
      paymentMethod: payment_method || 'Cash On Delivery',
      status: 'Pending',
      shippingCharge: isNaN(shippingFee) ? 60 : shippingFee,
      amount: totalAmount,
      userId: userIdVal
    };

    let order = null;
    if (user && typeof user.createOrder === 'function') {
      order = await user.createOrder(orderData).catch(async () => {
        return await Order.create(orderData).catch(() => null);
      });
    } else {
      order = await Order.create(orderData).catch(() => null);
    }

    if (order) {
      const OrderItem = require("../models/order-item");
      const CartItem = require("../models/cart-item");
      for (const prod of products) {
        const qty = prod.cartItem ? prod.cartItem.quantity : 1;
        await OrderItem.create({
          orderId: order.id,
          productId: prod.id,
          quantity: qty
        }).catch(() => {});
      }
      await CartItem.destroy({ where: { cartId: cart.id } }).catch(() => {});
    }

    return res.redirect('/orders-success');
  } catch (err) {
    console.log("Error in postOrder:", err);
    return res.redirect('/cart');
  }
};




