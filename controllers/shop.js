const Product = require("../models/product");
const Cart = require("../models/cart");
const Order = require("../models/order");
const OrderItem = require("../models/order-item");
const CartItem = require("../models/cart-item");
const Setting = require("../models/setting");
const sequelize = require("../util/database");
const crypto = require("crypto");
const { Op } = require("sequelize");

const ERROR_PREFIX = "In shop controller, ";

const normalizePhone = (phone) => {
  if (!phone) return "";
  let str = String(phone).replace(/[০-৯]/g, d => String.fromCharCode(d.charCodeAt(0) - 2534 + 48));
  let clean = str.replace(/\D/g, "");
  if (clean.startsWith("880")) {
    clean = "0" + clean.slice(3);
  }
  return clean;
};

const safeFindAllProducts = async (whereObj = {}) => {
  try {
    return await Product.findAll({ where: whereObj, order: [['id', 'DESC']] });
  } catch (err) {
    console.log("Fallback safeFindAllProducts:", err.message);
    try {
      return await Product.findAll({
        attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'subCategory', 'oldPrice', 'isHotDeal', 'isFreeDelivery', 'stock'],
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
        attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'subCategory', 'oldPrice', 'isHotDeal', 'isFreeDelivery', 'stock', 'images']
      });
    } catch (err2) {
      console.log("Secondary fallback safeFindProductById failed:", err2.message);
      return null;
    }
  }
};

const calculateOrderTotals = (products, area, discount = 0, advance = 0) => {
  let subtotal = 0;
  let hasFreeDelivery = false;

  (products || []).forEach(p => {
    const qty = p.cartItem ? p.cartItem.quantity : (p.orderItem ? p.orderItem.quantity : 1);
    const price = (p.orderItem && p.orderItem.price !== undefined && p.orderItem.price !== null)
      ? parseFloat(p.orderItem.price)
      : (p.price || 0);

    subtotal += price * qty;

    if (p.isFreeDelivery === true || p.isFreeDelivery === 1 || p.isFreeDelivery === 'true') {
      hasFreeDelivery = true;
    }
  });

  const selectedAreaFee = area ? parseInt(area) : 60;
  const shippingCharge = hasFreeDelivery ? 0 : (isNaN(selectedAreaFee) ? 60 : selectedAreaFee);
  const totalAmount = Math.max(0, subtotal + shippingCharge - (parseFloat(discount) || 0) - (parseFloat(advance) || 0));

  return {
    subtotal,
    hasFreeDelivery,
    shippingCharge,
    discount: parseFloat(discount) || 0,
    advance: parseFloat(advance) || 0,
    totalAmount
  };
};

const getUserCart = async (req) => {
  let cart = null;

  if (req && req.user) {
    cart = await Cart.findOne({ where: { userId: req.user.id } }).catch(() => null);
    if (!cart && typeof req.user.createCart === 'function') {
      cart = await req.user.createCart().catch(() => null);
    }
    if (!cart) {
      cart = await Cart.create({ userId: req.user.id }).catch(() => null);
    }
  } else {
    let cartId = (req && req.session) ? req.session.cartId : null;
    if (cartId) {
      cart = await Cart.findByPk(cartId).catch(() => null);
    }
    if (!cart) {
      cart = await Cart.create({ userId: null }).catch(() => null);
    }
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

exports.getProducts = async (req, res, next) => {
  try {
    const category = req.query.category;
    const subcategory = req.query.subcategory || req.query.subCategory;
    const search = req.query.search;
    let whereCondition = {};

    if (category && category !== "All") {
      whereCondition.category = category;
    }
    if (subcategory) {
      whereCondition.subCategory = subcategory;
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

    const prodObj = product.get ? product.get({ plain: true }) : product;
    let galleryList = [];
    if (prodObj.images) {
      try {
        galleryList = typeof prodObj.images === 'string' ? JSON.parse(prodObj.images) : prodObj.images;
      } catch (e) {
        galleryList = String(prodObj.images).split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    prodObj.galleryList = Array.isArray(galleryList) ? galleryList : [];

    let relatedProducts = [];
    try {
      relatedProducts = await safeFindAllProducts({
        category: product.category,
        id: { [Op.ne]: product.id }
      });
    } catch (e) {
      console.log("Fallback related products failed:", e.message);
    }

    res.render("shop/product-detail", {
      product: prodObj,
      pageTitle: product.title,
      path: "/products",
      relatedProducts: relatedProducts.slice(0, 4)
    });
  } catch (error) {
    console.log(ERROR_PREFIX + "getProduct: ", error);
    res.redirect("/products");
  }
};

exports.getIndex = async (req, res, next) => {
  try {
    const fs = require("fs");
    const path = require("path");

    let setting = await Setting.findOne().catch(() => null);
    const prods = await safeFindAllProducts();

    // 1. Load Banners
    let sliderBanners = [];
    try {
      const bannersFile = path.join(__dirname, '..', 'util', 'banners.json');
      if (fs.existsSync(bannersFile)) {
        const rawBanners = JSON.parse(fs.readFileSync(bannersFile, "utf8"));
        sliderBanners = (rawBanners || []).filter(b => b.status !== false && b.status !== 'inactive');
      }
    } catch (e) {
      console.log("Error loading sliderBanners:", e.message);
    }

    // 2. Load Banner Categories to exclude them completely from product category list
    let bannerCategories = [];
    let bannerCatNames = [];
    try {
      const catFile = path.join(__dirname, '..', 'util', 'banner-categories.json');
      if (fs.existsSync(catFile)) {
        const rawCats = JSON.parse(fs.readFileSync(catFile, "utf8"));
        bannerCategories = (rawCats || []).filter(c => c.status !== false && c.status !== 'inactive');
        bannerCatNames = bannerCategories.map(c => c.name ? c.name.trim().toLowerCase() : '').filter(Boolean);
      }
    } catch (e) {}

    const isBannerCategory = (catName) => {
      if (!catName) return true;
      const lower = catName.trim().toLowerCase();
      if (bannerCatNames.includes(lower)) return true;
      if (lower.includes('banner') || lower.includes('slider') || lower.includes('promo') || lower.includes('popup')) return true;
      return false;
    };

    // 3. Load Product Categories ONLY for front page category list
    let categoriesList = [];
    const Category = require("../models/category");
    const dbCategories = await Category.findAll({
      where: { status: true },
      order: [['order', 'ASC'], ['id', 'ASC']]
    }).catch(() => []);

    dbCategories.forEach(cat => {
      const cName = cat.name ? cat.name.trim() : '';
      if (cName && !isBannerCategory(cName)) {
        const exists = categoriesList.some(c => c.name.toLowerCase() === cName.toLowerCase());
        if (!exists) {
          categoriesList.push({
            id: cat.id,
            name: cName,
            img: cat.image || '/images/placeholder.jpg'
          });
        }
      }
    });

    const dbProductCatNames = Array.from(new Set((prods || []).map(p => p && p.category ? String(p.category).trim() : null).filter(Boolean)));
    dbProductCatNames.forEach(pCat => {
      if (pCat && !isBannerCategory(pCat)) {
        const exists = categoriesList.some(c => c.name.toLowerCase() === pCat.toLowerCase());
        if (!exists) {
          categoriesList.push({
            id: pCat,
            name: pCat,
            img: '/images/placeholder.jpg'
          });
        }
      }
    });

    categoriesList = categoriesList.filter(c => !isBannerCategory(c.name));

    // 4. Hot Deals
    const hotDeals = (prods || []).filter(p => p.isHotDeal === true || p.isHotDeal === 1 || p.isHotDeal === 'true');

    let footerConfig = {
      about_text: 'Adiba\'s Collection offers authentic lifestyle, clothing, and home appliances nationwide.',
      phone: '01700000000',
      email: 'support@adibacollection.top',
      address: 'Dhaka, Bangladesh',
      facebook: '',
      youtube: '',
      instagram: '',
      whatsapp: '8801700000000',
      copyright: '© 2026 Adiba\'s Collection. All Rights Reserved.',
      developer_name: 'OneHost BD',
      developer_url: 'https://onehostbd.com'
    };
    try {
      const adminController = require("./admin");
      footerConfig = adminController.loadFooterConfig();
    } catch (e) {}

    res.render("shop/index", {
      prods: prods || [],
      hotDeals: hotDeals || [],
      sliderBanners: sliderBanners || [],
      categoriesList: categoriesList || [],
      bannerCategories: bannerCategories || [],
      banners: sliderBanners || [],
      pageTitle: "Home",
      path: "/",
      siteSettings: setting ? setting.get({ plain: true }) : {},
      footerConfig: footerConfig
    });
  } catch (error) {
    console.log("In shop controller, getIndex: ", error);
    res.render("shop/index", {
      prods: [],
      hotDeals: [],
      sliderBanners: [],
      categoriesList: [],
      bannerCategories: [],
      banners: [],
      pageTitle: "Home",
      path: "/",
      siteSettings: {},
      footerConfig: {}
    });
  }
};

exports.getCart = async (req, res, next) => {
  try {
    const cart = await getUserCart(req);
    const products = await getCartProducts(cart);

    return res.render("shop/cart", {
      pageTitle: "Cart",
      path: "/cart",
      products: products || [],
    });
  } catch (error) {
    console.log("Error in shop controller getCart:", error);
    return res.render("shop/cart", {
      pageTitle: "Cart",
      path: "/cart",
      products: [],
    });
  }
};

exports.postCart = async (req, res, next) => {
  try {
    const productId = req.body.productId;
    const rawQty = req.body.quantity;
    const parsedQty = rawQty ? parseInt(rawQty) : 1;
    const addQty = isNaN(parsedQty) || !Number.isInteger(parsedQty) || parsedQty < 1 ? 1 : Math.min(parsedQty, 100);

    if (!productId) {
      return res.redirect("/cart");
    }

    const product = await safeFindProductById(productId);
    if (!product) {
      return res.redirect("/cart");
    }

    // Verify stock when adding to cart
    if (product.stock !== null && product.stock !== undefined && product.stock <= 0) {
      if (req.xhr || (req.headers.accept && req.headers.accept.includes("json"))) {
        return res.status(400).json({ success: false, message: "Out of stock!" });
      }
      return res.redirect("/cart");
    }

    const cart = await getUserCart(req);
    if (!cart) {
      return res.redirect("/cart");
    }

    const existingItem = await CartItem.findOne({
      where: { cartId: cart.id, productId: productId }
    }).catch(() => null);

    let targetQty = addQty;
    if (existingItem) {
      targetQty = Math.min((existingItem.quantity || 1) + addQty, 100);
      if (product.stock !== null && product.stock !== undefined && targetQty > product.stock) {
        targetQty = Math.max(1, product.stock);
      }
      existingItem.quantity = targetQty;
      await existingItem.save();
    } else {
      if (product.stock !== null && product.stock !== undefined && targetQty > product.stock) {
        targetQty = Math.max(1, product.stock);
      }
      await CartItem.create({
        cartId: cart.id,
        productId: productId,
        quantity: targetQty
      }).catch(async () => {
        if (typeof cart.addProduct === 'function') {
          await cart.addProduct(product, { through: { quantity: targetQty } });
        }
      });
    }

    const allItems = await CartItem.findAll({ where: { cartId: cart.id } }).catch(() => []);
    const totalCartCount = allItems.reduce((acc, item) => acc + (item.quantity || 1), 0);

    if (req.xhr || (req.headers.accept && req.headers.accept.includes("json"))) {
      return res.json({ success: true, message: "Product added to cart!", cartCount: totalCartCount });
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
    const parsedQty = parseInt(quantity);

    if (!productId || isNaN(parsedQty) || !Number.isInteger(parsedQty) || parsedQty <= 0 || parsedQty > 100) {
      return res.status(400).json({ success: false, message: 'Invalid quantity payload' });
    }

    const product = await safeFindProductById(productId);
    if (product && product.stock !== null && product.stock !== undefined && parsedQty > product.stock) {
      return res.status(400).json({ success: false, message: `Only ${product.stock} items available in stock` });
    }

    const cart = await getUserCart(req);
    if (!cart) {
      return res.status(400).json({ success: false, message: 'Cart not found' });
    }

    const item = await CartItem.findOne({ where: { cartId: cart.id, productId: productId } }).catch(() => null);

    if (item) {
      item.quantity = parsedQty;
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
    let targetOrderId = req.query.orderId ? parseInt(req.query.orderId) : null;
    let rawOrders = [];

    const sessionOrderIds = (req.session && req.session.orderIds) ? req.session.orderIds : [];

    let whereClause = null;
    if (req.user && req.user.isAdmin) {
      if (targetOrderId && !isNaN(targetOrderId)) {
        whereClause = { id: targetOrderId };
      } else {
        whereClause = {};
      }
    } else if (req.user) {
      if (targetOrderId && !isNaN(targetOrderId)) {
        whereClause = { id: targetOrderId, userId: req.user.id };
      } else {
        whereClause = { userId: req.user.id };
      }
    } else if (sessionOrderIds.length > 0) {
      if (targetOrderId && !isNaN(targetOrderId)) {
        if (sessionOrderIds.includes(targetOrderId)) {
          whereClause = { id: targetOrderId };
        } else {
          whereClause = { id: -1 }; 
        }
      } else {
        whereClause = { id: { [Op.in]: sessionOrderIds } };
      }
    }

    if (whereClause) {
      rawOrders = await Order.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']]
      }).catch(() => []);
    }

    const orders = [];
    for (const ord of rawOrders) {
      const ordObj = ord.get ? ord.get({ plain: true }) : ord;
      const orderItems = await OrderItem.findAll({ where: { orderId: ord.id } }).catch(() => []);

      const products = [];
      let subtotal = 0;

      for (const item of orderItems) {
        const prod = await safeFindProductById(item.productId);
        const itemQty = item.quantity || 1;
        const itemUnitPrice = (item.price !== null && item.price !== undefined) 
          ? parseFloat(item.price) 
          : (prod ? parseFloat(prod.price || 0) : 0);

        const lineTotal = itemUnitPrice * itemQty;
        subtotal += lineTotal;

        const prodObj = prod ? (prod.get ? prod.get({ plain: true }) : prod) : {
          id: item.productId,
          title: "Product #" + item.productId,
          price: itemUnitPrice,
          imageUrl: "/images/placeholder.jpg"
        };

        prodObj.orderItem = {
          quantity: itemQty,
          price: itemUnitPrice,
          lineTotal: lineTotal
        };

        products.push(prodObj);
      }

      ordObj.products = products;
      ordObj.subtotal = subtotal;

      // Authoritative Stored Financial Values
      ordObj.shippingCharge = (ordObj.shippingCharge !== null && ordObj.shippingCharge !== undefined)
        ? parseFloat(ordObj.shippingCharge)
        : 60;
      ordObj.discount = parseFloat(ordObj.discount || 0);
      ordObj.advance = parseFloat(ordObj.advance || 0);
      ordObj.totalAmount = (ordObj.amount !== null && ordObj.amount !== undefined && parseFloat(ordObj.amount) >= 0)
        ? parseFloat(ordObj.amount)
        : Math.max(0, subtotal + ordObj.shippingCharge - ordObj.discount - ordObj.advance);

      orders.push(ordObj);
    }

    // STRICTLY READ-ONLY (No DB mutations)

    return res.render('shop/orders', {
      path: '/orders',
      pageTitle: 'Your Orders',
      orders: orders
    });
  } catch (err) {
    console.log("Error in getOrders:", err);
    return res.render('shop/orders', {
      path: '/orders',
      pageTitle: 'Your Orders',
      orders: []
    });
  }
};

exports.postOrder = async (req, res, next) => {
  const { name, phone, address, area, payment_method, productId, quantity } = req.body;
  const normalizedPhone = normalizePhone(phone);

  if (quantity !== undefined && quantity !== null && quantity !== '') {
    const parsedQty = parseInt(quantity);
    if (isNaN(parsedQty) || !Number.isInteger(parsedQty) || parsedQty <= 0 || parsedQty > 100) {
      return res.redirect('/cart');
    }
  }

  const cart = await getUserCart(req);

  // Idempotency Protection
  const payloadHash = crypto.createHash("md5").update(JSON.stringify({
    productId: productId || "",
    name: name || "",
    phone: normalizedPhone,
    area: area || "",
    address: address || "",
    cartId: cart ? cart.id : ""
  })).digest("hex");

  const now = Date.now();
  if (req.session && req.session.lastOrderHash === payloadHash && (now - (req.session.lastOrderTime || 0)) < 5000) {
    if (req.session.lastOrderId) {
      return res.redirect('/orders-success?orderId=' + req.session.lastOrderId);
    }
  }

  let products = [];
  if (cart) {
    products = await getCartProducts(cart);
  }

  if ((!products || products.length === 0) && productId) {
    const pId = parseInt(productId);
    const pQty = quantity ? parseInt(quantity) : 1;

    if (!isNaN(pId) && pId > 0 && Number.isInteger(pQty) && pQty > 0 && pQty <= 100) {
      const singleProd = await safeFindProductById(pId);
      if (singleProd) {
        const prodObj = singleProd.get ? singleProd.get({ plain: true }) : singleProd;
        prodObj.cartItem = { quantity: pQty };
        products = [prodObj];
      }
    }
  }

  if ((!products || products.length === 0) && req.body.cartItemsJson) {
    try {
      const parsed = JSON.parse(req.body.cartItemsJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        for (const item of parsed) {
          const pId = parseInt(item.productId || item.id);
          const pQty = parseInt(item.quantity) || 1;
          if (pId && !isNaN(pId) && Number.isInteger(pQty) && pQty > 0 && pQty <= 100) {
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
      console.log("Error parsing cartItemsJson in postOrder:", e.message);
    }
  }

  if (!products || products.length === 0) {
    return res.redirect('/cart');
  }

  let t = null;
  try {
    t = await sequelize.transaction();
  } catch (txErr) {
    console.error("Failed to start DB transaction:", txErr.message);
    return res.redirect('/cart');
  }

  try {
    // Atomic Row Lock & Stock Verification inside Transaction
    for (const prod of products) {
      const qty = prod.cartItem ? prod.cartItem.quantity : 1;
      const dbProd = await Product.findByPk(prod.id, {
        transaction: t,
        lock: t.LOCK ? t.LOCK.UPDATE : undefined
      });

      if (!dbProd) {
        throw new Error(`Product ${prod.id} no longer exists.`);
      }

      if (dbProd.stock !== null && dbProd.stock !== undefined) {
        if (dbProd.stock < qty) {
          throw new Error(`Insufficient stock for ${dbProd.title}. Requested: ${qty}, Available: ${dbProd.stock}`);
        }
        dbProd.stock = Math.max(0, dbProd.stock - qty);
        await dbProd.save({ transaction: t });
      }
    }

    const totals = calculateOrderTotals(products, area, 0, 0);

    const orderData = {
      invoiceId: 'INV-TEMP',
      name: (name && name.trim()) ? name.trim() : 'Customer',
      phone: normalizedPhone || '01700000000',
      address: (address && address.trim()) ? address.trim() : 'Dhaka',
      area: area || '60',
      paymentMethod: payment_method || 'Cash On Delivery',
      status: 'Pending',
      shippingCharge: totals.shippingCharge,
      amount: totals.totalAmount
    };

    let order = null;
    try {
      order = await Order.create({ ...orderData, userId: (req && req.user) ? req.user.id : null }, { transaction: t });
    } catch (userColErr) {
      console.log("Creating order without userId column fallback:", userColErr.message);
      order = await Order.create(orderData, { transaction: t });
    }

    order.invoiceId = 'INV-' + order.id;
    await order.save({ transaction: t });

    for (const prod of products) {
      const qty = prod.cartItem ? prod.cartItem.quantity : 1;
      const unitPrice = prod.price || 0;
      try {
        await OrderItem.create({
          orderId: order.id,
          productId: prod.id,
          quantity: qty,
          price: unitPrice
        }, { transaction: t });
      } catch (itemErr) {
        console.log("Fallback OrderItem.create without price column:", itemErr.message);
        await OrderItem.create({
          orderId: order.id,
          productId: prod.id,
          quantity: qty
        }, { transaction: t });
      }
    }

    if (cart) {
      await CartItem.destroy({ where: { cartId: cart.id }, transaction: t });
    }

    await t.commit();

    if (req && req.session) {
      req.session.lastOrderHash = payloadHash;
      req.session.lastOrderTime = now;
      req.session.lastOrderId = order.id;
      req.session.orderIds = req.session.orderIds || [];
      req.session.orderIds.push(order.id);
      if (typeof req.session.save === 'function') req.session.save(() => {});
    }

    return res.redirect('/orders-success?orderId=' + order.id);

  } catch (err) {
    if (t) await t.rollback().catch(() => {});
    console.error("Error in postOrder transaction:", err.message);
    return res.redirect('/cart');
  }
};

exports.getOrderTrack = async (req, res, next) => {
  try {
    const query = req.query.orderId ? req.query.orderId.trim() : '';

    if (!query) {
      return res.render('shop/order-track', {
        path: '/order-track',
        pageTitle: 'Order Tracking',
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
      const cleanDigits = normalizePhone(query);
      if (cleanDigits.length >= 10) {
        whereConditions.push({ phone: cleanDigits });
      } else if (cleanDigits.length > 0) {
        whereConditions.push({ id: parseInt(cleanDigits) });
        whereConditions.push({ invoiceId: 'INV-' + cleanDigits });
      }
    }

    let rawOrders = [];
    if (whereConditions.length > 0) {
      rawOrders = await Order.findAll({
        where: { [Op.or]: whereConditions },
        order: [['id', 'DESC']]
      }).catch(() => []);
    }

    const orders = [];
    for (const ord of rawOrders) {
      const ordObj = ord.get ? ord.get({ plain: true }) : ord;
      const orderItems = await OrderItem.findAll({ where: { orderId: ord.id } }).catch(() => []);

      const products = [];
      let subtotal = 0;

      for (const item of orderItems) {
        const prod = await safeFindProductById(item.productId);
        const itemQty = item.quantity || 1;
        const itemUnitPrice = (item.price !== null && item.price !== undefined) 
          ? parseFloat(item.price) 
          : (prod ? parseFloat(prod.price || 0) : 0);

        const lineTotal = itemUnitPrice * itemQty;
        subtotal += lineTotal;

        const prodObj = prod ? (prod.get ? prod.get({ plain: true }) : prod) : {
          id: item.productId,
          title: "Product #" + item.productId,
          price: itemUnitPrice,
          imageUrl: "/images/placeholder.jpg"
        };

        prodObj.orderItem = {
          quantity: itemQty,
          price: itemUnitPrice,
          lineTotal: lineTotal
        };

        products.push(prodObj);
      }

      ordObj.products = products;
      ordObj.subtotal = subtotal;

      // Authoritative Stored Financial Values
      ordObj.shippingCharge = (ordObj.shippingCharge !== null && ordObj.shippingCharge !== undefined)
        ? parseFloat(ordObj.shippingCharge)
        : 60;
      ordObj.discount = parseFloat(ordObj.discount || 0);
      ordObj.advance = parseFloat(ordObj.advance || 0);
      ordObj.totalAmount = (ordObj.amount !== null && ordObj.amount !== undefined && parseFloat(ordObj.amount) >= 0)
        ? parseFloat(ordObj.amount)
        : Math.max(0, subtotal + ordObj.shippingCharge - ordObj.discount - ordObj.advance);

      orders.push(ordObj);
    }

    // STRICTLY READ-ONLY (No DB mutations)

    return res.render('shop/order-track', {
      path: '/order-track',
      pageTitle: 'Order Tracking',
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
      pageTitle: 'Order Tracking',
      orders: [],
      order: null,
      searchQuery: req.query.orderId || '',
      orderId: req.query.orderId || '',
      searched: true
    });
  }
};
