const Product = require("../models/product");
const Cart = require("../models/cart");
const sequelize = require("../util/database");

const ERROR_PREFIX = "In shop controller, ";

const { Op } = require("sequelize");

const safeFindAllProducts = async (whereObj = {}) => {
  try {
    return await Product.findAll({ where: whereObj, order: [['id', 'DESC']] });
  } catch (err) {
    console.log("Fallback safeFindAllProducts:", err.message);
    try {
      return await Product.findAll({
        attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal', 'isFreeDelivery'],
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
        attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal', 'isFreeDelivery']
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
    if (subcategory) {
      whereCondition.subcategory = subcategory;
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

exports.getOrderTrack = async (req, res, next) => {
  try {
    const query = (req.query.orderId || req.query.phone || req.query.searchQuery || '').trim();
    if (!query) {
      return res.render('shop/order-track', {
        path: '/order-track',
        pageTitle: 'Order Tracking - One Commerce',
        orders: [],
        order: null,
        searchQuery: '',
        orderId: '',
        searched: false
      });
    }

    const Order = require('../models/order');
    const OrderItem = require('../models/order-item');
    const Sequelize = require('sequelize');
    const Op = Sequelize.Op;

    const cleanDigits = query.replace(/[^0-9]/g, '');

    const whereConditions = [];
    if (cleanDigits && !isNaN(parseInt(cleanDigits))) {
      whereConditions.push({ id: parseInt(cleanDigits) });
    }
    whereConditions.push({ invoiceId: { [Op.like]: `%${query}%` } });

    if (cleanDigits.length >= 6) {
      whereConditions.push({ phone: { [Op.like]: `%${cleanDigits}%` } });
    } else if (query.length >= 3) {
      whereConditions.push({ phone: { [Op.like]: `%${query}%` } });
    }

    const rawOrders = await Order.findAll({
      where: { [Op.or]: whereConditions },
      order: [['createdAt', 'DESC']]
    }).catch(() => []);

    const orders = [];
    for (const ord of rawOrders) {
      const ordObj = ord.get ? ord.get({ plain: true }) : ord;
      const items = await OrderItem.findAll({ where: { orderId: ordObj.id } }).catch(() => []);
      const products = [];
      let subtotal = 0;
      for (const item of items) {
        const prod = await safeFindProductById(item.productId);
        if (prod) {
          const prodObj = prod.get ? prod.get({ plain: true }) : prod;
          const qty = item.quantity || 1;
          prodObj.orderItem = { quantity: qty };
          products.push(prodObj);
          subtotal += (prodObj.price || 0) * qty;
        }
      }
      ordObj.products = products;
      const hasFreeDelivery = (products || []).some(p => p.isFreeDelivery === true || p.isFreeDelivery === 1 || p.isFreeDelivery === 'true');
      const shipFee = hasFreeDelivery ? 0 : ((ordObj.shippingCharge !== null && ordObj.shippingCharge !== undefined) ? Number(ordObj.shippingCharge) : (isNaN(parseInt(ordObj.area)) ? 60 : parseInt(ordObj.area)));
      const disc = Number(ordObj.discount || 0);
      const adv = Number(ordObj.advance || 0);
      ordObj.subtotal = subtotal;
      ordObj.shippingCharge = shipFee;
      ordObj.discount = disc;
      ordObj.advance = adv;
      ordObj.totalAmount = hasFreeDelivery ? (subtotal - disc - adv) : ((ordObj.amount && Number(ordObj.amount) > 0) ? Number(ordObj.amount) : (subtotal + shipFee - disc - adv));
      if (hasFreeDelivery && ord.save && ord.shippingCharge !== 0) {
        ord.shippingCharge = 0;
        ord.amount = ordObj.totalAmount;
        await ord.save().catch(() => {});
      }
      orders.push(ordObj);
    }

    return res.render('shop/order-track', {
      path: '/order-track',
      pageTitle: 'Order Tracking - One Commerce',
      orders: orders,
      order: orders.length > 0 ? orders[0] : null,
      searchQuery: query,
      orderId: query,
      searched: true
    });
  } catch (err) {
    console.log("Error in getOrderTrack:", err);
    return res.render('shop/order-track', {
      path: '/order-track',
      pageTitle: "Home - One Commerce",
      path: "/",
      siteSettings: {},
      bannerCategories: [],
      banners: [],
      footerConfig: {}
    });
  }
};

const getUserCart = async (req) => {
  const Cart = require("../models/cart");
  let cartId = (req && req.session) ? req.session.cartId : null;

  if (cartId) {
    let cart = await Cart.findByPk(cartId).catch(() => null);
    if (cart) {
      if (req && req.user && cart.userId && cart.userId !== req.user.id) {
        cart = await Cart.create({ userId: req.user.id }).catch(() => null);
        if (cart && req.session) {
          req.session.cartId = cart.id;
          if (typeof req.session.save === 'function') req.session.save(() => {});
        }
      }
      return cart;
    }
  }

  let cart = null;
  if (req && req.user && typeof req.user.createCart === 'function') {
    cart = await req.user.createCart().catch(() => null);
  }
  if (!cart) {
    cart = await Cart.create({ userId: (req && req.user) ? req.user.id : null }).catch(() => null);
  }

  if (cart && req && req.session) {
    req.session.cartId = cart.id;
    if (typeof req.session.save === 'function') {
      req.session.save(() => {});
    }
  }
  return cart;
};

const getCartProducts = async (cart) => {
  if (!cart) return [];
  try {
    const products = await cart.getProducts();
    if (products && products.length > 0) return products;
  } catch (err) {
    console.log("Fallback cart.getProducts:", err.message);
  }

  try {
    const CartItem = require("../models/cart-item");
    const cartItems = await CartItem.findAll({ where: { cartId: cart.id } }).catch(() => []);
    const products = [];
    for (const item of cartItems) {
      const prod = await safeFindProductById(item.productId);
      if (prod) {
        const prodObj = prod.get ? prod.get({ plain: true }) : prod;
        prodObj.cartItem = { quantity: item.quantity || 1 };
        products.push(prodObj);
      }
    }
    return products;
  } catch (err2) {
    console.log("Secondary fallback getCartProducts failed:", err2.message);
    return [];
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
    const addQty = isNaN(qty) || qty < 1 ? 1 : Math.min(qty, 100);
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
      existingItem.quantity = Math.min((existingItem.quantity || 1) + addQty, 100);
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

    if (action === 'order_now') {
      return res.redirect('/cart');
    }

    return res.redirect('/cart');
  } catch (error) {
    console.log("Error in postCart:", error);
    return res.redirect("/cart");
  }
};

exports.postCartDeleteProduct = async (req, res, next) => {
  try {
    const productId = req.body.productId;
    const cart = await getUserCart(req);
    if (!cart) {
      return res.redirect("/cart");
    }

    const CartItem = require("../models/cart-item");
    await CartItem.destroy({
      where: { cartId: cart.id, productId: productId }
    }).catch(async () => {
      const products = await cart.getProducts({ where: { id: productId } });
      if (products && products.length > 0) {
        await products[0].cartItem.destroy();
      }
    });

    return res.redirect("/cart");
  } catch (error) {
    console.log("Error in postCartDeleteProduct:", error);
    return res.redirect("/cart");
  }
};

exports.postCartUpdateQty = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const cart = await getUserCart(req);
    if (!cart) {
      return res.status(400).json({ success: false, message: 'Cart not found' });
    }

    const newQty = Math.max(1, Math.min(parseInt(quantity) || 1, 100));

    const CartItem = require("../models/cart-item");
    const item = await CartItem.findOne({ where: { cartId: cart.id, productId: productId } }).catch(() => null);

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
    const Order = require("../models/order");

    let targetOrderId = req.query.orderId ? parseInt(req.query.orderId) : null;
    let rawOrders = [];

    const sessionOrderIds = (req.session && req.session.orderIds) ? req.session.orderIds : [];

    if (targetOrderId && !isNaN(targetOrderId)) {
      const isAllowed = sessionOrderIds.includes(targetOrderId) || (req.user && req.user.isAdmin);
      if (isAllowed) {
        rawOrders = await Order.findAll({ where: { id: targetOrderId } }).catch(() => []);
      }
    }

    if ((!rawOrders || rawOrders.length === 0) && sessionOrderIds.length > 0) {
      const { Op } = require("sequelize");
      rawOrders = await Order.findAll({
        where: { id: { [Op.in]: sessionOrderIds } },
        order: [['createdAt', 'DESC']]
      }).catch(() => []);
    }

    const orders = [];
    for (const ord of rawOrders) {
      const ordObj = ord.get ? ord.get({ plain: true }) : ord;
      const OrderItem = require("../models/order-item");
      const orderItems = await OrderItem.findAll({ where: { orderId: ord.id } }).catch(() => []);

      const products = [];
      for (const item of orderItems) {
        const prod = await safeFindProductById(item.productId);
        if (prod) {
          const prodObj = prod.get ? prod.get({ plain: true }) : prod;
          prodObj.cartItem = { quantity: item.quantity || 1 };
          products.push(prodObj);
        }
      }
      ordObj.products = products;

      const totals = calculateOrderTotals(products, ord.area, ord.discount, ord.advance);
      ordObj.shippingCharge = totals.shippingCharge;
      ordObj.subtotal = totals.subtotal;
      ordObj.totalAmount = totals.totalAmount;

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
  let t = null;
  try {
    t = await sequelize.transaction();
  } catch (txErr) {
    console.error("Failed to start DB transaction:", txErr.message);
    return res.redirect('/cart');
  }

  try {
    const { name, phone, address, area, payment_method, productId, quantity, cartItemsJson } = req.body;

    if (quantity !== undefined && quantity !== null && quantity !== '') {
      const parsedQty = parseInt(quantity);
      if (isNaN(parsedQty) || parsedQty <= 0 || parsedQty > 100) {
        await t.rollback();
        return res.redirect('/cart');
      }
    }

    const cart = await getUserCart(req);
    let products = [];

    // Priority 1: DB Cart is Authoritative
    if (cart) {
      products = await getCartProducts(cart);
    }

    // Priority 2: Direct Single Product Order Submission
    if ((!products || products.length === 0) && productId) {
      const pId = parseInt(productId);
      const pQty = quantity ? parseInt(quantity) : 1;

      if (isNaN(pId) || pId <= 0 || isNaN(pQty) || pQty <= 0 || pQty > 100) {
        await t.rollback();
        return res.redirect('/cart');
      }

      const singleProd = await safeFindProductById(pId);
      if (singleProd) {
        const prodObj = singleProd.get ? singleProd.get({ plain: true }) : singleProd;
        prodObj.cartItem = { quantity: pQty };
        products = [prodObj];
      }
    }

    // Priority 3: Form Payload Fallback (only if DB cart & productId absent)
    if ((!products || products.length === 0) && cartItemsJson) {
      try {
        const parsed = JSON.parse(cartItemsJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            const pId = parseInt(item.productId || item.id);
            const pQty = parseInt(item.quantity) || 1;
            if (pId && !isNaN(pId) && pQty > 0 && pQty <= 100) {
              const prod = await safeFindProductById(pId);
              if (prod) {
                const prodObj = prod.get ? prod.get({ plain: true }) : prod;
                prodObj.cartItem = { quantity: pQty };
                products.push(prodObj);
              }
            }
          }
        }
      } catch (e) {
        console.log("Error parsing cartItemsJson:", e.message);
      }
    }

    // Strict Validation: Cancel cleanly if no valid products exist
    if (!products || products.length === 0) {
      await t.rollback();
      return res.redirect('/cart');
    }

    const totals = calculateOrderTotals(products, area);

    const Order = require("../models/order");
    const orderData = {
      invoiceId: 'INV-TEMP',
      name: (name && name.trim()) ? name.trim() : 'Customer',
      phone: (phone && phone.trim()) ? phone.trim() : '01700000000',
      address: (address && address.trim()) ? address.trim() : 'Dhaka',
      area: area || '60',
      paymentMethod: payment_method || 'Cash On Delivery',
      status: 'Pending',
      shippingCharge: totals.shippingCharge,
      amount: totals.totalAmount
    };

    const order = await Order.create(orderData, { transaction: t });

    order.invoiceId = 'INV-' + order.id;
    await order.save({ transaction: t });

    const OrderItem = require("../models/order-item");
    const CartItem = require("../models/cart-item");

    for (const prod of products) {
      const qty = prod.cartItem ? prod.cartItem.quantity : 1;
      await OrderItem.create({
        orderId: order.id,
        productId: prod.id,
        quantity: qty
      }, { transaction: t });
    }

    if (cart) {
      await CartItem.destroy({ where: { cartId: cart.id }, transaction: t });
    }

    await t.commit();

    if (req && req.session) {
      req.session.orderIds = req.session.orderIds || [];
      req.session.orderIds.push(order.id);
      if (typeof req.session.save === 'function') req.session.save(() => {});
    }

    return res.redirect('/orders-success?orderId=' + order.id);

  } catch (err) {
    if (t) await t.rollback().catch(() => {});
    console.error("Error in postOrder transaction:", err);
    return res.redirect('/cart');
  }
};

exports.getOrderTrack = async (req, res, next) => {
  try {
    const Order = require("../models/order");
    const query = req.query.orderId ? req.query.orderId.trim() : '';

    if (!query) {
      return res.render('shop/order-track', {
        path: '/order-track',
        pageTitle: 'Order Tracking - One Commerce',
        orders: [],
        order: null,
        searchQuery: '',
        orderId: '',
        searched: false
      });
    }

    let whereConditions = [];

    if (query.toUpperCase().startsWith('INV-')) {
      whereConditions.push({ invoiceId: query.toUpperCase() });
    } else {
      const cleanDigits = query.replace(/\D/g, '');
      if (cleanDigits.length >= 10) {
        whereConditions.push({ phone: cleanDigits });
      } else if (cleanDigits.length > 0) {
        whereConditions.push({ id: parseInt(cleanDigits) });
        whereConditions.push({ invoiceId: 'INV-' + cleanDigits });
      }
    }

    let rawOrders = [];
    if (whereConditions.length > 0) {
      const { Op } = require("sequelize");
      rawOrders = await Order.findAll({
        where: { [Op.or]: whereConditions },
        order: [['id', 'DESC']]
      }).catch(() => []);
    }

    const orders = [];
    for (const ord of rawOrders) {
      const ordObj = ord.get ? ord.get({ plain: true }) : ord;
      const OrderItem = require("../models/order-item");
      const orderItems = await OrderItem.findAll({ where: { orderId: ord.id } }).catch(() => []);

      const products = [];
      for (const item of orderItems) {
        const prod = await safeFindProductById(item.productId);
        if (prod) {
          const prodObj = prod.get ? prod.get({ plain: true }) : prod;
          prodObj.cartItem = { quantity: item.quantity || 1 };
          products.push(prodObj);
        }
      }
      ordObj.products = products;

      const totals = calculateOrderTotals(products, ord.area, ord.discount, ord.advance);
      ordObj.shippingCharge = totals.shippingCharge;
      ordObj.subtotal = totals.subtotal;
      ordObj.totalAmount = totals.totalAmount;

      orders.push(ordObj);
    }

    return res.render('shop/order-track', {
      path: '/order-track',
      pageTitle: 'Order Tracking - One Commerce',
      orders: orders,
      order: orders.length > 0 ? orders[0] : null,
      searchQuery: query,
      orderId: query,
      searched: true
    });
  } catch (err) {
    console.log("Error in getOrderTrack:", err);
    return res.render('shop/order-track', {
      path: '/order-track',
      pageTitle: 'Order Tracking - One Commerce',
      orders: [],
      order: null,
      searchQuery: req.query.orderId || '',
      orderId: req.query.orderId || '',
      searched: true
    });
  }
};
