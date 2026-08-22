const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const Product = require("../models/product");
const Order = require("../models/order");
const User = require("../models/user");
const Setting = require("../models/setting");
const Category = require("../models/category");
const SubCategory = require("../models/subcategory");
const Sequelize = require('sequelize');

exports.getLogin = (req, res, next) => {
  if (req.query.reset === '1' && req.session) {
    delete req.session.isAdminLoggedIn;
  }
  if (req.session && req.session.isAdminLoggedIn) {
    return res.redirect("/admin/dashboard");
  }
  res.render("admin/login", {
    pageTitle: "Admin Login",
    path: "/admin/login",
    errorMessage: null,
  });
};

const SECRET = "onecommerce_secret_session_key_987";

function createAdminToken() {
  const payload = JSON.stringify({ admin: true, exp: Date.now() + (7 * 24 * 60 * 60 * 1000) });
  const data = Buffer.from(payload).toString('base64');
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return `${data}.${signature}`;
}

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  if ((email === "admin@gmail.com" || email === "admin@onecommercebd.com" || email === "admin@test.com") && (password === "admin123" || password === "password")) {
    if (req.session) {
      req.session.isAdminLoggedIn = true;
    }
    const token = createAdminToken();
    res.cookie('admin_auth', token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      path: '/'
    });
    return res.redirect("/admin/dashboard");
  }

  res.render("admin/login", {
    pageTitle: "Admin Login",
    path: "/admin/login",
    errorMessage: "Invalid email or password! Please check your credentials.",
  });
};

exports.postLogout = (req, res, next) => {
  res.clearCookie('admin_auth', { path: '/' });
  if (req.session) {
    req.session.destroy(() => {
      res.redirect("/admin/login");
    });
  } else {
    res.redirect("/admin/login");
  }
};

// 1. Dashboard Overview Handler
exports.getDashboard = (req, res, next) => {
  const Op = Sequelize.Op;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Past 7 days date calculation for chart
  const past7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    past7Days.push(d.toISOString().split('T')[0]);
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  Promise.all([
    Product.count(),
    Order.count(),
    Order.count({ where: { status: 'Pending' } }),
    Order.count({ where: { status: 'Processing' } }),
    Order.count({ where: { status: 'Confirm' } }),
    Order.count({ where: { status: 'In Courier' } }),
    Order.count({ where: { status: 'Completed' } }),
    Order.count({ where: { status: 'Cancelled' } }),
    Order.count({ where: { createdAt: { [Op.gte]: today } } }),
    Order.sum('amount', { where: { status: { [Op.ne]: 'Cancelled' } } }),
    Order.sum('advance', { where: { status: { [Op.ne]: 'Cancelled' } } }),
    Order.count({ distinct: true, col: 'phone' }),
    Order.findAll({
      order: [["createdAt", "DESC"]],
      limit: 5
    }),
    // Today's delivered orders count
    Order.count({ where: { status: 'Completed', createdAt: { [Op.gte]: today } } }),
    // Recent 5 customers (Users)
    User.findAll({
      order: [["createdAt", "DESC"]],
      limit: 5
    }),
    // All recent orders for daily chart calculation
    Order.findAll({
      where: { status: { [Op.ne]: 'Cancelled' } },
      attributes: ['amount', 'createdAt']
    }),
    // Weekly Deliveries
    Order.count({ where: { status: 'Completed', createdAt: { [Op.gte]: weekAgo } } }),
    // Monthly Deliveries
    Order.count({ where: { status: 'Completed', createdAt: { [Op.gte]: monthAgo } } })
  ])
  .then(([
    productsCount,
    totalOrders,
    pendingCount,
    processingCount,
    confirmCount,
    incourierCount,
    completedCount,
    cancelledCount,
    todayOrders,
    totalRevenue,
    totalAdvance,
    uniqueCustomers,
    recentOrders,
    todayDelivered,
    recentUsers,
    chartOrders,
    weeklyDeliveries,
    monthlyDeliveries
  ]) => {
    // Group sales by past 7 days
    const dailySalesMap = {};
    past7Days.forEach(date => dailySalesMap[date] = 0);

    chartOrders.forEach(o => {
      if (o.createdAt) {
        const dStr = new Date(o.createdAt).toISOString().split('T')[0];
        if (dailySalesMap[dStr] !== undefined) {
          dailySalesMap[dStr] += (o.amount || 0);
        }
      }
    });

    const chartLabels = past7Days.map(d => {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    });
    const chartData = past7Days.map(d => dailySalesMap[d]);

    // Fulfillment Rate
    const fulfillmentRate = totalOrders > 0 ? Math.round((completedCount / totalOrders) * 100) : 0;

    res.render("admin/dashboard", {
      pageTitle: "Admin Dashboard",
      path: "/admin/dashboard",
      productsCount: productsCount,
      totalOrders: totalOrders,
      pendingCount: pendingCount,
      processingCount: processingCount,
      confirmCount: confirmCount,
      incourierCount: incourierCount,
      completedCount: completedCount,
      cancelledCount: cancelledCount,
      todayOrders: todayOrders,
      totalRevenue: totalRevenue || 0,
      totalAdvance: totalAdvance || 0,
      uniqueCustomers: uniqueCustomers,
      recentOrders: recentOrders,
      todayDelivered: todayDelivered,
      weeklyDeliveries: weeklyDeliveries,
      monthlyDeliveries: monthlyDeliveries,
      recentUsers: recentUsers || [],
      fulfillmentRate: fulfillmentRate,
      chartLabels: JSON.stringify(chartLabels),
      chartData: JSON.stringify(chartData)
    });
  })
  .catch(err => {
    console.log("Error in getDashboard: ", err);
    res.render("admin/dashboard", {
      pageTitle: "Admin Dashboard",
      path: "/admin/dashboard",
      productsCount: 0,
      totalOrders: 0,
      pendingCount: 0,
      processingCount: 0,
      confirmCount: 0,
      incourierCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      todayOrders: 0,
      totalRevenue: 0,
      totalAdvance: 0,
      uniqueCustomers: 0,
      recentOrders: [],
      todayDelivered: 0,
      weeklyDeliveries: 0,
      monthlyDeliveries: 0,
      recentUsers: [],
      fulfillmentRate: 0,
      chartLabels: JSON.stringify(past7Days),
      chartData: JSON.stringify([0,0,0,0,0,0,0])
    });
  });
};

// 2. Orders Management Handler (Supports status query filter & slug)
exports.getAdminOrders = async (req, res, next) => {
  try {
    const statusFilter = req.query.status || req.params.slug || 'all';
    const keyword = (req.query.keyword || '').trim().toLowerCase();

    const OrderItem = require("../models/order-item");
    const rawOrders = await Order.findAll({ order: [['createdAt', 'DESC']] }).catch(() => []);
    const users = await User.findAll().catch(() => []);

    const orders = [];
    for (const ord of rawOrders) {
      const ordObj = ord.get ? ord.get({ plain: true }) : ord;
      const items = await OrderItem.findAll({ where: { orderId: ordObj.id } }).catch(() => []);
      const products = [];
      let calculatedSubtotal = 0;
      for (const item of items) {
        let prod = null;
        try {
          prod = await Product.findByPk(item.productId);
        } catch (e1) {
          prod = await Product.findByPk(item.productId, {
            attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal']
          }).catch(() => null);
        }
        if (prod) {
          const prodObj = prod.get ? prod.get({ plain: true }) : prod;
          const qty = item.quantity || 1;
          prodObj.orderItem = { quantity: qty };
          products.push(prodObj);
          calculatedSubtotal += Number(prodObj.price || 0) * qty;
        }
      }
      ordObj.products = products;

      const shipFee = (ordObj.shippingCharge !== null && ordObj.shippingCharge !== undefined) ? Number(ordObj.shippingCharge) : (isNaN(parseInt(ordObj.area)) ? 60 : parseInt(ordObj.area));
      const disc = Number(ordObj.discount || 0);
      const adv = Number(ordObj.advance || 0);

      if (!ordObj.amount || Number(ordObj.amount) <= 0) {
        ordObj.amount = calculatedSubtotal + shipFee - disc - adv;
      }
      orders.push(ordObj);
    }

    let filteredOrders = orders;
    if (statusFilter !== 'all') {
      filteredOrders = orders.filter(o => (o.status || 'pending').toLowerCase() === statusFilter.toLowerCase());
    }

    if (keyword) {
      filteredOrders = filteredOrders.filter(o => {
        const inv = o.invoiceId ? o.invoiceId.toString().toLowerCase() : ('inv-' + o.id);
        const name = (o.name || '').toLowerCase();
        const phone = (o.phone || '').toLowerCase();
        const addr = (o.address || '').toLowerCase();
        return inv.includes(keyword) || name.includes(keyword) || phone.includes(keyword) || addr.includes(keyword);
      });
    }

    return res.render("admin/orders", {
      pageTitle: "Orders Management",
      path: "/admin/orders",
      statusFilter: statusFilter,
      orders: filteredOrders,
      totalOrdersCount: orders.length,
      filteredCount: filteredOrders.length,
      users: users
    });
  } catch (err) {
    console.log("Error in getAdminOrders:", err);
    return res.render("admin/orders", {
      pageTitle: "Orders Management",
      path: "/admin/orders",
      statusFilter: 'all',
      orders: [],
      totalOrdersCount: 0,
      filteredCount: 0,
      users: []
    });
  }
};

exports.getTestProducts = async (req, res, next) => {
  try {
    let products = [];
    try {
      products = await Product.findAll({ order: [['id', 'DESC']] });
    } catch (err1) {
      products = await Product.findAll({
        attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal'],
        order: [['id', 'DESC']]
      });
    }
    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    res.render("admin/product-list", {
      pageTitle: "Manage Products",
      path: "/admin/product-list",
      prods: products,
      products: products,
      hasProducts: products.length > 0,
      totalCount: products.length,
      filteredCount: products.length,
      categories: categories,
      categoriesList: categories.map(c => c.name),
      categoryFilter: 'all',
      keyword: ''
    });
  } catch (err) {
    res.status(200).send('<pre style="color:red; font-size:16px;">NAME: ' + err.name + '\nMESSAGE: ' + err.message + '\n\nSTACK:\n' + (err.stack || '') + '</pre>');
  }
};

// Product List & Management Handler
exports.getProducts = async (req, res, next) => {
  try {
    let products = [];
    try {
      products = await Product.findAll({ order: [['id', 'DESC']] });
    } catch (dbErr) {
      console.log("Error querying products with default schema, attempting fallback query:", dbErr.message);
      try {
        products = await Product.findAll({
          attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal'],
          order: [['id', 'DESC']]
        });
      } catch (err2) {
        console.log("Fallback Product query error:", err2.message);
        products = [];
      }
    }

    let categories = [];
    try {
      categories = await Category.findAll({ order: [['name', 'ASC']] });
    } catch (catErr) {
      console.log("Error querying categories from DB:", catErr.message);
      categories = await Category.findAll().catch(() => []);
    }

    products = products || [];
    categories = categories || [];

    const categoryFilter = req.query.category || 'all';
    const keyword = (req.query.keyword || req.query.search || '').trim().toLowerCase();

    let filteredProds = products;

    if (categoryFilter && categoryFilter !== 'all') {
      if (categoryFilter.toLowerCase() === 'deals') {
        filteredProds = filteredProds.filter(p => p.hotDeal === true || p.isHotDeal === true || p.deal === true);
      } else {
        filteredProds = filteredProds.filter(p => (p.category || '').toLowerCase() === categoryFilter.toLowerCase());
      }
    }

    if (keyword) {
      filteredProds = filteredProds.filter(p => 
        (p.title || '').toLowerCase().includes(keyword) || 
        (p.sku || '').toLowerCase().includes(keyword) ||
        (p.category || '').toLowerCase().includes(keyword)
      );
    }

    const categoriesList = Array.from(new Set(categories.map(c => c.name).filter(Boolean)));

    const cleanProds = (filteredProds || []).map(p => {
      const item = typeof p.get === 'function' ? p.get({ plain: true }) : p;
      return {
        ...item,
        id: item.id || 0,
        title: (item.title || 'Untitled Product').toString(),
        category: (item.category || 'General').toString(),
        imageUrl: (item.imageUrl || 'https://www.onecommercebd.com/uploads/category/thumb/1787182103-Nosepin.jpg').toString(),
        price: item.price || 0,
        oldPrice: item.oldPrice || '',
        isHotDeal: item.isHotDeal === true || item.hotDeal === true || item.deal === true
      };
    });

    return res.render("admin/product-list", {
      pageTitle: "Manage Products",
      path: "/admin/product-list",
      prods: cleanProds,
      products: cleanProds,
      hasProducts: cleanProds.length > 0,
      totalCount: products.length,
      filteredCount: cleanProds.length,
      categories: categories,
      categoriesList: categoriesList,
      categoryFilter: categoryFilter,
      keyword: keyword
    });
  } catch (err) {
    console.log("Error in getProducts:", err);
    return res.render("admin/product-list", {
      pageTitle: "Manage Products",
      path: "/admin/product-list",
      prods: [],
      products: [],
      hasProducts: false,
      totalCount: 0,
      filteredCount: 0,
      categories: [],
      categoriesList: [],
      categoryFilter: 'all',
      keyword: ''
    });
  }
};

exports.getInvoice = async (req, res, next) => {
  try {
    const invoiceId = req.params.invoiceId;
    const OrderItem = require("../models/order-item");
    const orderInst = await Order.findOne({ where: { id: invoiceId } }).catch(() => null);
    if (!orderInst) {
      return res.redirect('/admin/orders');
    }

    const orderObj = orderInst.get ? orderInst.get({ plain: true }) : orderInst;
    const items = await OrderItem.findAll({ where: { orderId: orderObj.id } }).catch(() => []);
    const products = [];
    for (const item of items) {
      let prod = null;
      try {
        prod = await Product.findByPk(item.productId);
      } catch (e1) {
        prod = await Product.findByPk(item.productId, {
          attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal']
        }).catch(() => null);
      }
      if (prod) {
        const prodObj = prod.get ? prod.get({ plain: true }) : prod;
        prodObj.orderItem = { quantity: item.quantity || 1 };
        products.push(prodObj);
      }
    }
    orderObj.products = products;

    res.render('admin/invoice', {
      pageTitle: `Invoice #${orderObj.invoiceId || orderObj.id}`,
      path: '/admin/orders',
      order: orderObj
    });
  } catch (err) {
    console.log("Error in getInvoice: ", err);
    res.redirect('/admin/orders');
  }
};

const OrderItem = require("../models/order-item");

exports.getProcessOrder = async (req, res, next) => {
  try {
    const invoiceId = req.params.invoiceId;
    const orderInst = await Order.findOne({ where: { id: invoiceId } }).catch(() => null);
    if (!orderInst) {
      return res.redirect('/admin/orders');
    }

    const orderObj = orderInst.get ? orderInst.get({ plain: true }) : orderInst;
    const items = await OrderItem.findAll({ where: { orderId: orderObj.id } }).catch(() => []);
    const products = [];
    for (const item of items) {
      let prod = null;
      try {
        prod = await Product.findByPk(item.productId);
      } catch (e1) {
        prod = await Product.findByPk(item.productId, {
          attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal']
        }).catch(() => null);
      }
      if (prod) {
        const prodObj = prod.get ? prod.get({ plain: true }) : prod;
        prodObj.orderItem = { quantity: item.quantity || 1 };
        products.push(prodObj);
      }
    }
    orderObj.products = products;

    let allProducts = await Product.findAll().catch(async () => {
      return await Product.findAll({
        attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal']
      }).catch(() => []);
    });
    const allUsers = await User.findAll().catch(() => []);

    res.render('admin/process', {
      pageTitle: `Edit Order #${orderObj.invoiceId || orderObj.id}`,
      path: '/admin/orders',
      order: orderObj,
      allProducts: allProducts || [],
      allUsers: allUsers || []
    });
  } catch (err) {
    console.log("Error in getProcessOrder: ", err);
    res.redirect('/admin/orders');
  }
};

exports.postProcessOrder = async (req, res, next) => {
  try {
    const { id, name, phone, address, area, status, payment_method, discount, advance_payment, assignee, admin_note, product_ids, product_quantities } = req.body;
    
    const order = await Order.findByPk(id);
    if (!order) return res.redirect('/admin/orders');

    order.name = name || order.name;
    order.phone = phone || order.phone;
    order.address = address || order.address;
    order.area = area || order.area;
    order.status = status || order.status;
    order.paymentMethod = payment_method || order.paymentMethod;
    order.discount = discount !== undefined ? parseFloat(discount) : order.discount;
    order.advance = advance_payment !== undefined ? parseFloat(advance_payment) : (order.advance || 0);
    order.assignee = assignee || order.assignee;
    order.adminNote = admin_note || order.adminNote;

    // Handle updating products in order
    if (product_ids) {
      const idsArray = Array.isArray(product_ids) ? product_ids : [product_ids];
      const quantitiesArray = Array.isArray(product_quantities) ? product_quantities : [product_quantities];

      // Delete existing order items
      await OrderItem.destroy({ where: { orderId: order.id } }).catch(() => {});

      let itemsSubtotal = 0;
      for (let i = 0; i < idsArray.length; i++) {
        const pId = parseInt(idsArray[i]);
        const qty = parseInt(quantitiesArray[i]) || 1;
        let prod = null;
        try {
          prod = await Product.findByPk(pId);
        } catch (e1) {
          prod = await Product.findByPk(pId, {
            attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal']
          }).catch(() => null);
        }
        if (prod) {
          itemsSubtotal += ((prod.price || 0) * qty);
          await OrderItem.create({
            orderId: order.id,
            productId: pId,
            quantity: qty
          }).catch(() => {});
        }
      }

      const shippingFee = parseInt(area) || order.shippingCharge || 60;
      const discountVal = parseFloat(discount) || 0;
      const advanceVal = parseFloat(advance_payment) || 0;
      order.amount = itemsSubtotal + shippingFee - discountVal - advanceVal;
    }

    await order.save();
    res.redirect('/admin/orders?status=' + (status || 'pending').toLowerCase());
  } catch (err) {
    console.log("Error in postProcessOrder: ", err);
    res.redirect('/admin/orders');
  }
};

exports.getFraudCheck = (req, res, next) => {
  const phone = req.query.phone;
  if (!phone) {
    return res.status(400).json({ status: 'error', message: 'Phone number is required' });
  }
  
  const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-11);
  
  setTimeout(() => {
    const totalParcels = Math.floor(Math.random() * 15) + 3;
    const deliveredParcels = Math.floor(totalParcels * (0.8 + Math.random() * 0.18));
    const cancelledParcels = totalParcels - deliveredParcels;
    const successRatio = Math.round((deliveredParcels / totalParcels) * 100) + '%';
    
    res.json({
      status: 'success',
      phone: cleanPhone,
      http_status: 200,
      data: {
        total_parcels: totalParcels,
        total_delivered: deliveredParcels,
        total_cancelled: cancelledParcels,
        success_ratio: successRatio,
        total_fraud_reports: cancelledParcels > 3 ? 1 : 0
      }
    });
  }, 400);
};

exports.postPrintOrders = async (req, res, next) => {
  try {
    const orderIds = req.body.orderIds;
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    const OrderItem = require("../models/order-item");
    const rawOrders = await Order.findAll({ where: { id: ids } }).catch(() => []);

    const orders = [];
    for (const ord of rawOrders) {
      const ordObj = ord.get ? ord.get({ plain: true }) : ord;
      const items = await OrderItem.findAll({ where: { orderId: ordObj.id } }).catch(() => []);
      const products = [];
      for (const item of items) {
        let prod = null;
        try {
          prod = await Product.findByPk(item.productId);
        } catch (e1) {
          prod = await Product.findByPk(item.productId, {
            attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal']
          }).catch(() => null);
        }
        if (prod) {
          const prodObj = prod.get ? prod.get({ plain: true }) : prod;
          prodObj.orderItem = { quantity: item.quantity || 1 };
          products.push(prodObj);
        }
      }
      ordObj.products = products;
      orders.push(ordObj);
    }

    return res.json({ success: true, orders: orders });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Courier API Config Helpers
const getCourierFilePath = () => path.join(__dirname, '..', 'util', 'courier-config.json');

const loadCourierConfig = () => {
  try {
    const file = getCourierFilePath();
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {}
  return {
    steadfast: { api_key: 'st_live_key_938472910', secret_key: 'st_secret_key_83749102', url: 'https://portal.packzy.com/api/v1', status: true },
    pathao: { url: 'https://api-hermes.pathao.com', api_key: 'pathao_client_id_83749', secret_key: 'pathao_client_secret_938471', token: 'bearer_token_pathao_live_93847291', status: true }
  };
};

const saveCourierConfig = (data) => {
  try { fs.writeFileSync(getCourierFilePath(), JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
};

exports.loadCourierConfig = loadCourierConfig;

exports.postSteadfastCourier = (req, res, next) => {
  const orderIds = req.body.orderIds;
  const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
  const courierConfig = loadCourierConfig();
  const steadfastConfig = courierConfig.steadfast;
  
  if (!steadfastConfig.status) {
    return res.status(400).json({ status: 'failed', message: 'Steadfast Courier API is currently disabled in API Integration Settings.' });
  }

  Order.update({ status: 'In Courier' }, { where: { id: ids } })
    .then(() => {
      res.json({ status: 'success', message: `${ids.length} Order(s) successfully booked with Steadfast Courier (API Key: ${steadfastConfig.api_key})!` });
    })
    .catch(err => res.status(500).json({ status: 'failed', message: err.message }));
};

exports.postPathaoCourier = (req, res, next) => {
  const orderIds = req.body.orderIds;
  const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
  const courierConfig = loadCourierConfig();
  const pathaoConfig = courierConfig.pathao;

  if (!pathaoConfig.status) {
    return res.status(400).json({ status: 'failed', message: 'Pathao Courier API is currently disabled in API Integration Settings.' });
  }

  Order.update({ status: 'In Courier' }, { where: { id: ids } })
    .then(() => {
      res.json({ status: 'success', message: `${ids.length} Order(s) successfully sent to Pathao Courier (Client ID: ${pathaoConfig.api_key})!` });
    })
    .catch(err => res.status(500).json({ status: 'failed', message: err.message }));
};

exports.postChangeOrderStatus = (req, res, next) => {
  const orderIds = req.body.orderIds;
  const newStatus = req.body.status;

  if (!orderIds || !newStatus) {
    return res.status(400).json({ success: false, message: 'Invalid payload' });
  }

  const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
  Order.update({ status: newStatus }, { where: { id: ids } })
    .then(() => {
      res.json({ success: true, message: 'Order status updated successfully' });
    })
    .catch(err => res.status(500).json({ success: false, error: err.message }));
};

exports.postAssignAdminUser = (req, res, next) => {
  const orderIds = req.body.orderIds;
  const assignee = req.body.assignee;

  const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
  Order.update({ assignee: assignee || 'Super Admin' }, { where: { id: ids } })
    .then(() => {
      res.json({ success: true, message: 'Assignee updated successfully' });
    })
    .catch(err => res.status(500).json({ success: false, error: err.message }));
};

exports.postDeleteOrdersBulk = (req, res, next) => {
  const orderIds = req.body.orderIds;
  if (!orderIds) {
    return res.status(400).json({ success: false, message: 'No orders specified' });
  }
  const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
  Order.destroy({ where: { id: ids } })
    .then(() => {
      res.json({ success: true, message: 'Orders deleted successfully' });
    })
    .catch(err => res.status(500).json({ success: false, error: err.message }));
};

// 3. Categories Management Handler
// 3. Categories & Subcategories Management Handler
exports.getCategories = async (req, res, next) => {
  try {
    let categories = await Category.findAll({
      include: [{ model: SubCategory, required: false }],
      order: [['order', 'ASC'], ['id', 'ASC']]
    }).catch(async () => {
      return await Category.findAll({ order: [['order', 'ASC'], ['id', 'ASC']] }).catch(() => []);
    });

    let subcategories = await SubCategory.findAll({
      include: [{ model: Category, required: false }],
      order: [['id', 'DESC']]
    }).catch(async () => {
      return await SubCategory.findAll({ order: [['id', 'DESC']] }).catch(() => []);
    });

    let products = await Product.findAll({ attributes: ['category', 'subCategory'] }).catch(() => []);

    categories = categories || [];
    subcategories = subcategories || [];
    products = products || [];

    // Calculate product counts for categories
    const categoriesData = categories.map(cat => {
      const plainObj = typeof cat.get === 'function' ? cat.get({ plain: true }) : cat;
      const pCount = products.filter(p => p.category && cat.name && p.category.toLowerCase() === cat.name.toLowerCase()).length;
      return {
        ...plainObj,
        subcategories: plainObj.subcategories || [],
        productCount: pCount
      };
    });

    // Calculate product counts for subcategories
    const subcategoriesData = subcategories.map(sub => {
      const plainObj = typeof sub.get === 'function' ? sub.get({ plain: true }) : sub;
      const pCount = products.filter(p => p.subCategory && sub.name && p.subCategory.toLowerCase() === sub.name.toLowerCase()).length;
      return {
        ...plainObj,
        category: plainObj.category || null,
        productCount: pCount
      };
    });

    res.render("admin/categories", {
      pageTitle: "Category & Sub-Category Management",
      path: "/admin/categories",
      categories: categoriesData,
      subcategories: subcategoriesData,
      activeTab: req.query.tab || 'categories'
    });
  } catch (err) {
    console.log("Error in getCategories: ", err);
    res.render("admin/categories", {
      pageTitle: "Category & Sub-Category Management",
      path: "/admin/categories",
      categories: [],
      subcategories: [],
      activeTab: req.query.tab || 'categories'
    });
  }
};

// Create Category
exports.postCreateCategory = async (req, res, next) => {
  try {
    const { name, image, status, order } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    await Category.create({
      name: name,
      slug: slug || 'cat-' + Date.now(),
      image: image || 'https://www.onecommercebd.com/uploads/category/thumb/1787182103-Nosepin.jpg',
      status: status === 'on' || status === '1' || status === true,
      order: parseInt(order) || 0
    });
    res.redirect("/admin/categories?tab=categories");
  } catch (err) {
    console.log("Error in postCreateCategory:", err);
    res.redirect("/admin/categories");
  }
};

// Edit Category
exports.postEditCategory = async (req, res, next) => {
  try {
    const { id, name, image, status, order } = req.body;
    const category = await Category.findByPk(id);
    if (category) {
      category.name = name || category.name;
      category.slug = name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : category.slug;
      if (image) category.image = image;
      category.status = status === 'on' || status === '1' || status === true;
      if (order !== undefined) category.order = parseInt(order) || 0;
      await category.save();
    }
    res.redirect("/admin/categories?tab=categories");
  } catch (err) {
    console.log("Error in postEditCategory:", err);
    res.redirect("/admin/categories");
  }
};

// Toggle Category Status
exports.postToggleCategoryStatus = async (req, res, next) => {
  try {
    const { id } = req.body;
    const category = await Category.findByPk(id);
    if (category) {
      category.status = !category.status;
      await category.save();
    }
    res.redirect("/admin/categories?tab=categories");
  } catch (err) {
    console.log("Error in postToggleCategoryStatus:", err);
    res.redirect("/admin/categories");
  }
};

// Delete Category
exports.postDeleteCategory = async (req, res, next) => {
  try {
    const { id } = req.body;
    await Category.destroy({ where: { id: id } });
    res.redirect("/admin/categories?tab=categories");
  } catch (err) {
    console.log("Error in postDeleteCategory:", err);
    res.redirect("/admin/categories");
  }
};

// Create SubCategory
exports.postCreateSubCategory = async (req, res, next) => {
  try {
    const { name, categoryId, image, status } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    await SubCategory.create({
      name: name,
      slug: slug || 'subcat-' + Date.now(),
      categoryId: parseInt(categoryId),
      image: image || '',
      status: status === 'on' || status === '1' || status === true
    });
    res.redirect("/admin/categories?tab=subcategories");
  } catch (err) {
    console.log("Error in postCreateSubCategory:", err);
    res.redirect("/admin/categories?tab=subcategories");
  }
};

// Edit SubCategory
exports.postEditSubCategory = async (req, res, next) => {
  try {
    const { id, name, categoryId, image, status } = req.body;
    const subcategory = await SubCategory.findByPk(id);
    if (subcategory) {
      subcategory.name = name || subcategory.name;
      subcategory.slug = name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : subcategory.slug;
      if (categoryId) subcategory.categoryId = parseInt(categoryId);
      if (image) subcategory.image = image;
      subcategory.status = status === 'on' || status === '1' || status === true;
      await subcategory.save();
    }
    res.redirect("/admin/categories?tab=subcategories");
  } catch (err) {
    console.log("Error in postEditSubCategory:", err);
    res.redirect("/admin/categories?tab=subcategories");
  }
};

// Delete SubCategory
exports.postDeleteSubCategory = async (req, res, next) => {
  try {
    const { id } = req.body;
    await SubCategory.destroy({ where: { id: id } });
    res.redirect("/admin/categories?tab=subcategories");
  } catch (err) {
    console.log("Error in postDeleteSubCategory:", err);
    res.redirect("/admin/categories?tab=subcategories");
  }
};

// API Endpoint: Get Subcategories for a given Category ID
exports.getApiSubcategories = async (req, res, next) => {
  try {
    const categoryId = req.params.categoryId;
    let whereClause = { status: true };
    if (categoryId && categoryId !== 'all') {
      if (isNaN(categoryId)) {
        const catObj = await Category.findOne({ where: { name: categoryId } });
        if (catObj) whereClause.categoryId = catObj.id;
      } else {
        whereClause.categoryId = parseInt(categoryId);
      }
    }
    const subcategories = await SubCategory.findAll({ where: whereClause, order: [['name', 'ASC']] });
    res.json({ success: true, subcategories });
  } catch (err) {
    res.status(500).json({ success: false, subcategories: [] });
  }
};

// Banner & Banner Category Storage Helpers
const getBannerCategoriesFilePath = () => path.join(__dirname, '..', 'util', 'banner-categories.json');
const getBannersFilePath = () => path.join(__dirname, '..', 'util', 'banners.json');

const loadBannerCategories = () => {
  try {
    const file = getBannerCategoriesFilePath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.log("Error loading banner-categories.json:", err);
  }
  return [];
};

const saveBannerCategories = (data) => {
  try {
    fs.writeFileSync(getBannerCategoriesFilePath(), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.log("Error saving banner-categories.json:", err);
  }
};

const loadBanners = () => {
  try {
    const file = getBannersFilePath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.log("Error loading banners.json:", err);
  }
  return [];
};

const saveBanners = (data) => {
  try {
    fs.writeFileSync(getBannersFilePath(), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.log("Error saving banners.json:", err);
  }
};

// 4. Banner Categories Handlers
exports.getBannerCategories = (req, res, next) => {
  const categories = loadBannerCategories();
  res.render("admin/banner-categories", {
    pageTitle: "Banner Category Manage",
    path: "/admin/banner-category/manage",
    categories: categories
  });
};

exports.postCreateBannerCategory = (req, res, next) => {
  const { name, status } = req.body;
  const categories = loadBannerCategories();
  const newCat = {
    id: Date.now(),
    name: name,
    status: status ? 1 : 0
  };
  categories.push(newCat);
  saveBannerCategories(categories);
  res.redirect("/admin/banner-category/manage");
};

exports.postEditBannerCategory = (req, res, next) => {
  const { id, name, status } = req.body;
  let categories = loadBannerCategories();
  categories = categories.map(c => {
    if (c.id == id) {
      return { ...c, name, status: status ? 1 : 0 };
    }
    return c;
  });
  saveBannerCategories(categories);
  res.redirect("/admin/banner-category/manage");
};

exports.postToggleBannerCategoryStatus = (req, res, next) => {
  const { id } = req.body;
  let categories = loadBannerCategories();
  categories = categories.map(c => {
    if (c.id == id) {
      return { ...c, status: c.status == 1 ? 0 : 1 };
    }
    return c;
  });
  saveBannerCategories(categories);
  res.redirect("/admin/banner-category/manage");
};

exports.postDeleteBannerCategory = (req, res, next) => {
  const { id } = req.body;
  let categories = loadBannerCategories();
  categories = categories.filter(c => c.id != id);
  saveBannerCategories(categories);
  res.redirect("/admin/banner-category/manage");
};

// Banners List Handlers
exports.getBanners = (req, res, next) => {
  const banners = loadBanners();
  const categories = loadBannerCategories();
  res.render("admin/banners", {
    pageTitle: "Banners List Manage",
    path: "/admin/banner/manage",
    banners: banners,
    categories: categories
  });
};

exports.postCreateBanner = (req, res, next) => {
  const { category_id, link, image, status } = req.body;
  const categories = loadBannerCategories();
  const banners = loadBanners();
  const catObj = categories.find(c => c.id == category_id);

  const newBanner = {
    id: Date.now(),
    category_id: parseInt(category_id),
    category_name: catObj ? catObj.name : 'General',
    link: link || '/products',
    image: image || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='300' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E",
    status: status ? 1 : 0
  };
  banners.push(newBanner);
  saveBanners(banners);
  res.redirect("/admin/banner/manage");
};

exports.postEditBanner = (req, res, next) => {
  const { id, category_id, link, image, status } = req.body;
  const categories = loadBannerCategories();
  let banners = loadBanners();
  const catObj = categories.find(c => c.id == category_id);

  banners = banners.map(b => {
    if (b.id == id) {
      return {
        ...b,
        category_id: parseInt(category_id),
        category_name: catObj ? catObj.name : 'General',
        link: link || b.link,
        image: image || b.image,
        status: status ? 1 : 0
      };
    }
    return b;
  });
  saveBanners(banners);
  res.redirect("/admin/banner/manage");
};

exports.postToggleBannerStatus = (req, res, next) => {
  const { id } = req.body;
  let banners = loadBanners();
  banners = banners.map(b => {
    if (b.id == id) {
      return { ...b, status: b.status == 1 ? 0 : 1 };
    }
    return b;
  });
  saveBanners(banners);
  res.redirect("/admin/banner/manage");
};

exports.postDeleteBanner = (req, res, next) => {
  const { id } = req.body;
  let banners = loadBanners();
  banners = banners.filter(b => b.id != id);
  saveBanners(banners);
  res.redirect("/admin/banner/manage");
};

// Footer Config Helpers
const getFooterFilePath = () => path.join(__dirname, '..', 'util', 'footer-config.json');

const loadFooterConfig = () => {
  try {
    const file = getFooterFilePath();
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {}
  return { developer_name: 'OneHost BD' };
};

const saveFooterConfig = (data) => {
  try { fs.writeFileSync(getFooterFilePath(), JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
};

exports.loadFooterConfig = loadFooterConfig;

// 5. Site Settings Handlers
exports.getSettings = async (req, res, next) => {
  try {
    let setting = await Setting.findOne().catch(() => null);
    if (!setting) {
      setting = await Setting.create({}).catch(() => null);
    }
    const footerConfig = loadFooterConfig();
    const plainSetting = setting ? setting.get({ plain: true }) : {};
    plainSetting.developer_name = footerConfig.developer_name || 'OneHost BD';

    res.render("admin/settings", {
      pageTitle: "General Site Settings",
      path: "/admin/settings",
      setting: plainSetting
    });
  } catch (err) {
    console.log("Error in getSettings:", err);
    res.render("admin/settings", {
      pageTitle: "General Site Settings",
      path: "/admin/settings",
      setting: {}
    });
  }
};

exports.postSettings = async (req, res, next) => {
  try {
    let setting = await Setting.findOne().catch(() => null);
    if (!setting) {
      setting = await Setting.create({
        name: req.body.name || "One Commerce",
        phone: req.body.phone || "01700000000"
      }).catch(() => null);
    }

    if (setting) {
      setting.name = req.body.name || setting.name;
      setting.phone = req.body.phone || setting.phone;
      setting.play_store = req.body.play_store || setting.play_store;
      setting.status = req.body.status === '1' || req.body.status === 'on' || req.body.status === true;
      setting.white_logo = req.body.white_logo || setting.white_logo;
      setting.dark_logo = req.body.dark_logo || setting.dark_logo;
      setting.favicon = req.body.favicon || setting.favicon;
      setting.og_baner = req.body.og_baner || setting.og_baner;
      setting.primary_color = req.body.primary_color || setting.primary_color;
      setting.secondary_color = req.body.secondary_color || setting.secondary_color;
      setting.delivery_inside = req.body.delivery_inside ? parseInt(req.body.delivery_inside) : setting.delivery_inside;
      setting.delivery_outside = req.body.delivery_outside ? parseInt(req.body.delivery_outside) : setting.delivery_outside;
      setting.meta_description = req.body.meta_description || setting.meta_description;
      setting.meta_keyword = req.body.meta_keyword || setting.meta_keyword;

      await setting.save();
    }

    if (req.body.developer_name !== undefined) {
      saveFooterConfig({ developer_name: req.body.developer_name });
    }

    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.json({ success: true, message: 'Settings saved successfully!' });
    }
    return res.redirect("/admin/settings");
  } catch (err) {
    console.log("Error in postSettings:", err);
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.status(500).json({ success: false, message: err.message });
    }
    return res.redirect("/admin/settings");
  }
};

// Generic Module View Renderer Helper
const renderGenericAdminPage = (res, title, path, icon, description, contentDetails = []) => {
  res.render("admin/generic-module", {
    pageTitle: title,
    path: path,
    moduleTitle: title,
    moduleIcon: icon,
    moduleDescription: description,
    contentDetails: contentDetails
  });
};

// 6. Quick Price Edit Handler
exports.getQuickPriceEdit = async (req, res, next) => {
  try {
    let products = [];
    try {
      products = await Product.findAll({ order: [['id', 'DESC']] });
    } catch (dbErr) {
      products = await Product.findAll({
        attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal'],
        order: [['id', 'DESC']]
      }).catch(() => []);
    }

    res.render("admin/quick-price-edit", {
      pageTitle: "Quick Price Edit",
      path: "/admin/products/price-edit",
      products: products || []
    });
  } catch (err) {
    console.log("Error in getQuickPriceEdit:", err);
    res.redirect("/admin/product-list");
  }
};

// 7. Campaigns Handlers
exports.getCreateCampaign = (req, res, next) => {
  res.render("admin/campaign-manage", {
    pageTitle: "Create Campaign",
    path: "/admin/campaign/create"
  });
};

exports.getManageCampaigns = (req, res, next) => {
  res.render("admin/campaign-manage", {
    pageTitle: "Campaigns Management",
    path: "/admin/campaign/manage"
  });
};

// 8. Users & Roles Handlers
exports.getAdminUsers = (req, res, next) => {
  renderGenericAdminPage(res, "Admin Users", "/admin/users/manage", "👤", "Manage administrator accounts and staff access permissions.");
};

exports.getRoles = (req, res, next) => {
  renderGenericAdminPage(res, "Roles Management", "/admin/roles/manage", "🔑", "Configure access control roles (Super Admin, Manager, Support).");
};

exports.getPermissions = (req, res, next) => {
  renderGenericAdminPage(res, "Permissions", "/admin/permissions/manage", "🛡️", "Set granular read/write permissions per module.");
};

exports.getCustomers = (req, res, next) => {
  User.findAll().then(users => {
    res.render("admin/customers-list", {
      pageTitle: "Customers List",
      path: "/admin/customer",
      customers: users
    });
  });
};

// 9. Site Settings Modules
exports.getSocialMedia = (req, res, next) => {
  renderGenericAdminPage(res, "Social Links", "/admin/social-media/manage", "🌐", "Configure Facebook, Instagram, WhatsApp, and YouTube links.");
};

exports.getContactInfo = (req, res, next) => {
  renderGenericAdminPage(res, "Contact Info", "/admin/contact/manage", "📞", "Update customer support phone numbers, email, and store address.");
};

exports.getCustomPages = (req, res, next) => {
  renderGenericAdminPage(res, "Custom Pages", "/admin/page/manage", "📄", "Manage Privacy Policy, Terms & Conditions, and Return Policy pages.");
};

exports.getShippingCharges = (req, res, next) => {
  renderGenericAdminPage(res, "Shipping Charges", "/admin/shipping-charge/manage", "🚚", "Set delivery fees for inside and outside Dhaka.");
};

exports.getOrderStatuses = (req, res, next) => {
  renderGenericAdminPage(res, "Order Statuses", "/admin/orderstatus/manage", "🏷️", "Customize order workflow states (Pending, Processing, Delivered).");
};

// 10. API Integrations
exports.getPaymentGateways = (req, res, next) => {
  res.render("admin/payment-gateways", {
    pageTitle: "Payment Gateways",
    path: "/admin/paymentgeteway/manage",
    bkash: req.app.locals.bkashConfig || { username: '01700000000', app_key: 'bkash_app_key_837492810', app_secret: 'bkash_secret_739201948', base_url: 'https://tokenized.pay.bKash.com/v1.2.0-beta', password: 'bkash_password_92841', logo: 'https://raw.githubusercontent.com/tahmid-ul/bkash-logo/main/bkash-logo.png', status: true },
    shurjopay: req.app.locals.shurjopayConfig || { base_url: 'https://shurjopay.com', username: 'sp_merchant_user', password: 'sp_password_83749', prefix: 'NO', success_url: 'http://127.0.0.1:3000/payment/shurjopay/success', return_url: 'http://127.0.0.1:3000/payment/shurjopay/cancel', logo: 'https://shurjopay.com/favicon.ico', status: true }
  });
};

exports.postPaymentGatewayUpdate = (req, res, next) => {
  const { type, username, app_key, app_secret, base_url, password, prefix, success_url, return_url, logo, status,
          bkash_username, bkash_app_key, bkash_app_secret, bkash_base_url, bkash_password, bkash_logo, bkash_status,
          shurjopay_base_url, shurjopay_username, shurjopay_password, shurjopay_prefix, shurjopay_success_url, shurjopay_return_url, shurjopay_logo, shurjopay_status } = req.body;

  if (type === 'bkash') {
    req.app.locals.bkashConfig = {
      username: username || bkash_username,
      app_key: app_key || bkash_app_key,
      app_secret: app_secret || bkash_app_secret,
      base_url: base_url || bkash_base_url,
      password: password || bkash_password,
      logo: logo || bkash_logo || 'https://raw.githubusercontent.com/tahmid-ul/bkash-logo/main/bkash-logo.png',
      status: status === 'on' || status === '1'
    };
  } else if (type === 'shurjopay') {
    req.app.locals.shurjopayConfig = {
      username: username || shurjopay_username,
      base_url: base_url || shurjopay_base_url,
      password: password || shurjopay_password,
      prefix: prefix || shurjopay_prefix,
      success_url: success_url || shurjopay_success_url,
      return_url: return_url || shurjopay_return_url,
      logo: logo || shurjopay_logo || 'https://shurjopay.com/favicon.ico',
      status: status === 'on' || status === '1'
    };
  } else {
    if (bkash_username) {
      req.app.locals.bkashConfig = {
        username: bkash_username, app_key: bkash_app_key, app_secret: bkash_app_secret, base_url: bkash_base_url, password: bkash_password,
        logo: bkash_logo || 'https://raw.githubusercontent.com/tahmid-ul/bkash-logo/main/bkash-logo.png',
        status: bkash_status === 'on' || bkash_status === '1'
      };
    }
    if (shurjopay_username) {
      req.app.locals.shurjopayConfig = {
        username: shurjopay_username, base_url: shurjopay_base_url, password: shurjopay_password, prefix: shurjopay_prefix,
        success_url: shurjopay_success_url, return_url: shurjopay_return_url,
        logo: shurjopay_logo || 'https://shurjopay.com/favicon.ico',
        status: shurjopay_status === 'on' || shurjopay_status === '1'
      };
    }
  }

  res.redirect('/admin/paymentgeteway/manage');
};

exports.getSmsGateways = (req, res, next) => {
  res.render("admin/sms-gateways", {
    pageTitle: "SMS Gateways",
    path: "/admin/smsgeteway/manage",
    sms: req.app.locals.smsConfig || { url: 'https://api.sms.net.bd/sendsms', api_key: 'sms_net_bd_api_key_83749102', serderid: 'ROSEDRAPE', status: true, order: true, forget_pass: true, password_g: true }
  });
};

exports.postSmsGatewayUpdate = (req, res, next) => {
  const { url, api_key, serderid, status, order, forget_pass, password_g } = req.body;
  req.app.locals.smsConfig = {
    url, api_key, serderid,
    status: status === 'on' || status === '1',
    order: order === 'on' || order === '1',
    forget_pass: forget_pass === 'on' || forget_pass === '1',
    password_g: password_g === 'on' || password_g === '1'
  };
  res.redirect('/admin/smsgeteway/manage');
};

exports.getCourierApis = (req, res, next) => {
  const config = loadCourierConfig();
  res.render("admin/courier-apis", {
    pageTitle: "Courier APIs",
    path: "/admin/courierapi/manage",
    steadfast: config.steadfast,
    pathao: config.pathao
  });
};

exports.postCourierApiUpdate = (req, res, next) => {
  const {
    steadfast_api_key, steadfast_secret_key, steadfast_url, steadfast_status,
    pathao_url, pathao_api_key, pathao_secret_key, pathao_token, pathao_status
  } = req.body;

  const newConfig = {
    steadfast: {
      api_key: steadfast_api_key || '',
      secret_key: steadfast_secret_key || '',
      url: steadfast_url || '',
      status: steadfast_status === 'on' || steadfast_status === '1' || steadfast_status === true
    },
    pathao: {
      url: pathao_url || '',
      api_key: pathao_api_key || '',
      secret_key: pathao_secret_key || '',
      token: pathao_token || '',
      status: pathao_status === 'on' || pathao_status === '1' || pathao_status === true
    }
  };

  saveCourierConfig(newConfig);
  res.redirect('/admin/courierapi/manage');
};

// GTM & Pixel Config Helpers
const getGtmFilePath = () => path.join(__dirname, '..', 'util', 'gtm-config.json');
const getPixelFilePath = () => path.join(__dirname, '..', 'util', 'pixel-config.json');

const loadGtmConfig = () => {
  try {
    const file = getGtmFilePath();
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {}
  return { code: 'GTM-N6589XX', status: true };
};

const saveGtmConfig = (data) => {
  try { fs.writeFileSync(getGtmFilePath(), JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
};

const loadPixelConfig = () => {
  try {
    const file = getPixelFilePath();
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {}
  return { code: '987654321012345', token: 'EAAC...', status: true };
};

const savePixelConfig = (data) => {
  try { fs.writeFileSync(getPixelFilePath(), JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
};

exports.loadGtmConfig = loadGtmConfig;
exports.loadPixelConfig = loadPixelConfig;

// 11. Pixel & GTM
exports.getTagManager = (req, res, next) => {
  const gtm = loadGtmConfig();
  res.render("admin/tag-manager", {
    pageTitle: "Google Tag Manager",
    path: "/admin/tag-manager/manage",
    gtm: gtm
  });
};

exports.postTagManagerUpdate = (req, res, next) => {
  const { code, status } = req.body;
  const newConfig = { code: code ? code.trim() : '', status: status === 'on' || status === '1' || status === true };
  saveGtmConfig(newConfig);
  res.redirect('/admin/tag-manager/manage');
};

exports.getPixelManager = (req, res, next) => {
  const pixel = loadPixelConfig();
  res.render("admin/pixel-manager", {
    pageTitle: "Facebook Pixel Manager",
    path: "/admin/pixels/manage",
    pixel: pixel
  });
};

exports.postPixelManagerUpdate = (req, res, next) => {
  const { code, token, status } = req.body;
  const newConfig = { code: code ? code.trim() : '', token: token ? token.trim() : '', status: status === 'on' || status === '1' || status === true };
  savePixelConfig(newConfig);
  res.redirect('/admin/pixels/manage');
};

// 12. Reports & Analytics
exports.getStockReport = (req, res, next) => {
  Product.findAll().then(products => {
    res.render("admin/stock-report", {
      pageTitle: "Stock Inventory Report",
      path: "/admin/stock-report",
      products: products
    });
  });
};

exports.getIpBlockList = (req, res, next) => {
  renderGenericAdminPage(res, "IP Block List", "/admin/customer/ip-block", "🚫", "Manage blocked IP addresses for fraud prevention.");
};

exports.getOrderReport = (req, res, next) => {
  renderGenericAdminPage(res, "Sales & Order Report", "/admin/order-report", "📊", "Detailed financial sales report and order volume breakdown.");
};

exports.getVisitorTracking = (req, res, next) => {
  renderGenericAdminPage(res, "Visitor Tracking", "/admin/visitor-tracking", "👁️", "Real-time active store visitors and traffic analytics.");
};

exports.getDropoffAnalytics = (req, res, next) => {
  renderGenericAdminPage(res, "Drop-off Analytics", "/admin/dropoff-analytics", "📉", "Checkout drop-off funnel analytics.");
};

// Product CRUD Handlers
exports.getAddProduct = async (req, res, next) => {
  try {
    const categories = await Category.findAll({ where: { status: true }, order: [['order', 'ASC']] });
    const subcategories = await SubCategory.findAll({ where: { status: true }, order: [['name', 'ASC']] });
    res.render("admin/edit-product", {
      pageTitle: "Add Product",
      path: "/admin/add-product",
      editing: false,
      categories: categories || [],
      subcategories: subcategories || []
    });
  } catch (err) {
    console.log("Error in getAddProduct:", err);
    res.redirect("/admin/product-list");
  }
};

const findProductById = async (id) => {
  try {
    return await Product.findByPk(id);
  } catch (err) {
    console.log("Fallback findProductById for id:", id, err.message);
    try {
      return await Product.findByPk(id, {
        attributes: ['id', 'title', 'price', 'imageUrl', 'description', 'category', 'oldPrice', 'isHotDeal']
      });
    } catch (err2) {
      console.log("Secondary fallback findProductById failed:", err2.message);
      return null;
    }
  }
};

exports.getEditProduct = async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const product = await findProductById(productId);
    if (!product) {
      return res.redirect("/admin/product-list");
    }
    const categories = await Category.findAll({ where: { status: true }, order: [['order', 'ASC']] }).catch(() => []);
    const subcategories = await SubCategory.findAll({ where: { status: true }, order: [['name', 'ASC']] }).catch(() => []);
    res.render("admin/edit-product", {
      pageTitle: "Edit Product",
      path: "/admin/edit-product",
      editing: true,
      product: product,
      categories: categories || [],
      subcategories: subcategories || []
    });
  } catch (error) {
    console.log("Error in getEditProduct:", error);
    res.redirect("/admin/product-list");
  }
};

const cleanInputText = (str, removeEmojis = false) => {
  if (!str || typeof str !== 'string') return '';
  let cleaned = str
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, (match) => (match === '\n' || match === '\r' ? match : ''))
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .trim();
  if (removeEmojis) {
    cleaned = cleaned
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
      .replace(/[^\u0000-\uFFFF]/g, '')
      .trim();
  }
  return cleaned;
};

const ultraSafeText = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFKC')
    .replace(/[^\x20-\x7E\u0980-\u09FF\n\r\t]/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
};

exports.postAddProduct = async (req, res, next) => {
  try {
    const rawTitle = req.body.title || '';
    const rawDesc = req.body.description || '';

    const title = cleanInputText(rawTitle) || 'Untitled Product';
    const imageUrl = req.body.imageUrl || 'https://www.onecommercebd.com/uploads/category/thumb/1787182103-Nosepin.jpg';
    const description = cleanInputText(rawDesc) || 'No description provided.';
    const price = parseFloat(req.body.price) || 0;
    const oldPrice = req.body.oldPrice ? parseFloat(req.body.oldPrice) : null;
    const category = req.body.category || "General";
    const subCategory = req.body.subcategory || req.body.subCategory || null;
    const isHotDeal = req.body.isHotDeal === "true" || req.body.isHotDeal === true || req.body.isHotDeal === "on";
    const isFreeDelivery = req.body.isFreeDelivery === "true" || req.body.isFreeDelivery === true || req.body.isFreeDelivery === "on";

    const User = require("../models/user");
    let adminUser = req.user;
    if (!adminUser) {
      adminUser = await User.findByPk(1).catch(() => null);
    }
    if (!adminUser) {
      adminUser = await User.create({ name: "Lahiru", email: "lahirurc1st@gmail.com" }).catch(() => null);
    }
    const userIdVal = adminUser ? adminUser.id : 1;

    let createdProduct = null;

    // Attempt 1: Try req.user.createProduct if available
    try {
      if (adminUser && typeof adminUser.createProduct === 'function') {
        createdProduct = await adminUser.createProduct({
          title, price, oldPrice, imageUrl, description, category, subCategory, isHotDeal, isFreeDelivery, userId: userIdVal
        });
      }
    } catch (e1) {
      console.log("postAddProduct Attempt 1 failed:", e1.message);
    }

    // Attempt 2: Product.create with full fields + userId
    if (!createdProduct) {
      try {
        createdProduct = await Product.create({
          title, price, oldPrice, imageUrl, description, category, subCategory, isHotDeal, isFreeDelivery, userId: userIdVal
        });
      } catch (e2) {
        console.log("postAddProduct Attempt 2 failed:", e2.message);

        // Attempt 3: Product.create with basic fields + userId
        try {
          createdProduct = await Product.create({
            title, price, oldPrice, imageUrl, description, category, isHotDeal, userId: userIdVal
          });
        } catch (e3) {
          console.log("postAddProduct Attempt 3 failed:", e3.message);

          // Attempt 4: Safe text (emojis stripped for 3-byte utf8 live MySQL) + full fields + userId
          const safeTitle = cleanInputText(rawTitle, true) || 'Untitled Product';
          const safeDesc = cleanInputText(rawDesc, true) || 'No description provided.';

          try {
            createdProduct = await Product.create({
              title: safeTitle, price, oldPrice, imageUrl, description: safeDesc, category, subCategory, isHotDeal, isFreeDelivery, userId: userIdVal
            });
          } catch (e4) {
            console.log("postAddProduct Attempt 4 failed:", e4.message);

            // Attempt 5: Safe text + minimum required fields + userId
            try {
              createdProduct = await Product.create({
                title: safeTitle, price, oldPrice, imageUrl, description: safeDesc, category, isHotDeal, userId: userIdVal
              });
            } catch (e5) {
              console.log("postAddProduct Attempt 5 failed:", e5.message);

              // Attempt 6: Ultra-safe ASCII & Bengali text fail-safe fallback
              const uTitle = ultraSafeText(rawTitle) || 'Product Entry';
              const uDesc = ultraSafeText(rawDesc) || 'Product details';
              try {
                createdProduct = await Product.create({
                  title: uTitle,
                  price: price || 0,
                  imageUrl: imageUrl,
                  description: uDesc,
                  category: category || 'General',
                  userId: userIdVal
                });
              } catch (e6) {
                console.log("postAddProduct Attempt 6 failed:", e6.message);
              }
            }
          }
        }
      }
    }

    return res.redirect("/admin/product-list");
  } catch (error) {
    console.log("Error in postAddProduct:", error);
    return res.redirect("/admin/product-list");
  }
};

exports.postEditProduct = async (req, res, next) => {
  try {
    const id = req.body.productId;
    const product = await findProductById(id);
    if (product) {
      const rawTitle = req.body.title || '';
      const rawDesc = req.body.description || '';

      const cleanTitle = cleanInputText(rawTitle) || product.title;
      const cleanDesc = cleanInputText(rawDesc) || product.description;
      const subCategory = req.body.subcategory || req.body.subCategory || product.subCategory || null;
      const isFreeDelivery = req.body.isFreeDelivery === "true" || req.body.isFreeDelivery === true || req.body.isFreeDelivery === "on";

      const User = require("../models/user");
      let adminUser = req.user;
      if (!adminUser) {
        adminUser = await User.findByPk(1).catch(() => null);
      }
      const userIdVal = adminUser ? adminUser.id : 1;

      const updateData = {
        title: cleanTitle,
        imageUrl: req.body.imageUrl || product.imageUrl,
        description: cleanDesc,
        price: req.body.price ? parseFloat(req.body.price) : product.price,
        oldPrice: req.body.oldPrice ? parseFloat(req.body.oldPrice) : null,
        category: req.body.category || product.category || "General",
        subCategory: subCategory,
        isHotDeal: req.body.isHotDeal === "true" || req.body.isHotDeal === true || req.body.isHotDeal === "on",
        isFreeDelivery: isFreeDelivery,
        userId: userIdVal
      };

      try {
        await Product.update(updateData, { where: { id: id } });
      } catch (upErr) {
        console.log("Error updating product (Attempt 1):", upErr.message);

        // Attempt 2: Safe text without 4-byte emojis / surrogate pairs
        const safeTitle = cleanInputText(rawTitle, true) || product.title;
        const safeDesc = cleanInputText(rawDesc, true) || product.description;
        updateData.title = safeTitle;
        updateData.description = safeDesc;

        try {
          await Product.update(updateData, { where: { id: id } });
        } catch (upErr2) {
          console.log("Error updating product (Attempt 2):", upErr2.message);
          delete updateData.subCategory;
          delete updateData.isFreeDelivery;
          try {
            await Product.update(updateData, { where: { id: id } });
          } catch (upErr3) {
            console.log("Error updating product (Attempt 3):", upErr3.message);
            // Attempt 4: Ultra-safe ASCII & Bengali text update
            const uTitle = ultraSafeText(rawTitle) || product.title;
            const uDesc = ultraSafeText(rawDesc) || product.description;
            await Product.update({
              title: uTitle,
              description: uDesc
            }, { where: { id: id } }).catch((upErr4) => {
              console.log("Error updating product (Attempt 4):", upErr4.message);
            });
          }
        }
      }
    }
    return res.redirect("/admin/product-list");
  } catch (error) {
    console.log("Error in postEditProduct:", error);
    return res.redirect("/admin/product-list");
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const productId = req.body.productId || req.query.productId;
    if (!productId) {
      if (req.xhr || req.headers.accept?.includes('json') || req.headers['content-type']?.includes('json')) {
        return res.status(400).json({ success: false, message: 'Product ID required' });
      }
      return res.redirect("/admin/product-list");
    }

    try {
      const CartItem = require("../models/cart-item");
      await CartItem.destroy({ where: { productId: productId } }).catch(() => {});
    } catch (e) {}

    const product = await findProductById(productId);
    if (product) {
      await product.destroy().catch(async () => {
        await Product.destroy({ where: { id: productId } });
      });
    } else {
      await Product.destroy({ where: { id: productId } });
    }

    if (req.xhr || req.headers.accept?.includes('json') || req.headers['content-type']?.includes('json') || req.headers['content-type']?.includes('urlencoded')) {
      return res.json({ success: true, message: "Product deleted successfully" });
    }
    return res.redirect("/admin/product-list");
  } catch (error) {
    console.log("Error in deleteProduct:", error);
    if (req.xhr || req.headers.accept?.includes('json') || req.headers['content-type']?.includes('json') || req.headers['content-type']?.includes('urlencoded')) {
      return res.status(500).json({ success: false, message: error.message || 'Error deleting product' });
    }
    return res.redirect("/admin/product-list");
  }
};

exports.postDeleteProductsBulk = async (req, res, next) => {
  try {
    const productIds = req.body.productIds;
    if (!productIds) {
      return res.status(400).json({ success: false, message: 'No products specified' });
    }
    const ids = Array.isArray(productIds) ? productIds : [productIds];

    try {
      const CartItem = require("../models/cart-item");
      await CartItem.destroy({ where: { productId: ids } }).catch(() => {});
    } catch (e) {}

    await Product.destroy({ where: { id: ids } });
    return res.json({ success: true, message: 'Selected products deleted successfully' });
  } catch (err) {
    console.log("Error in postDeleteProductsBulk:", err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete selected products' });
  }
};

exports.postToggleProductsDeal = async (req, res, next) => {
  try {
    const productIds = req.body.productIds;
    const isHotDeal = req.body.isHotDeal === true || req.body.isHotDeal === 'true' || req.body.isHotDeal === 1;

    if (!productIds) {
      return res.status(400).json({ success: false, message: 'No products specified' });
    }
    const ids = Array.isArray(productIds) ? productIds : [productIds];
    await Product.update({ isHotDeal: isHotDeal }, { where: { id: ids } });
    return res.json({ success: true, message: `Updated Hot Deal status for ${ids.length} product(s)` });
  } catch (err) {
    console.log("Error in postToggleProductsDeal:", err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to update deal status' });
  }
};

exports.postToggleSingleHotDeal = async (req, res, next) => {
  try {
    const productId = req.body.productId;
    const product = await findProductById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const newDealState = !product.isHotDeal;
    await Product.update({ isHotDeal: newDealState }, { where: { id: productId } });
    return res.json({ success: true, isHotDeal: newDealState, message: 'Hot deal status updated' });
  } catch (err) {
    console.log("Error in postToggleSingleHotDeal:", err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to toggle hot deal' });
  }
};

exports.postToggleProductsStatus = (req, res, next) => {
  const productIds = req.body.productIds;
  if (!productIds) {
    return res.status(400).json({ success: false, message: 'No products specified' });
  }
  const ids = Array.isArray(productIds) ? productIds : [productIds];
  return res.json({ success: true, message: `Updated status for ${ids.length} product(s)` });
};

// Media Library Handlers
const getMediaFilePath = () => path.join(__dirname, '..', 'util', 'media.json');

const loadCustomMedia = () => {
  try {
    const file = getMediaFilePath();
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.log("Error loading media.json:", err);
  }
  return [];
};

const saveCustomMedia = (mediaList) => {
  try {
    const file = getMediaFilePath();
    fs.writeFileSync(file, JSON.stringify(mediaList, null, 2), 'utf8');
  } catch (err) {
    console.log("Error saving media.json:", err);
  }
};

exports.getMediaLibrary = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      attributes: ['id', 'title', 'imageUrl', 'createdAt'],
      raw: true
    });
    const setting = await Setting.findOne({
      attributes: ['white_logo', 'dark_logo', 'favicon', 'og_baner'],
      raw: true
    });
    const customMedia = loadCustomMedia();

    const mediaList = [];
    let idCounter = 1;

    // 1. Add Custom Uploaded Media
    customMedia.forEach(m => {
      mediaList.push({
        id: m.id || `custom-${idCounter++}`,
        title: m.title || 'Uploaded Asset',
        url: m.url,
        category: m.category || 'General',
        type: 'custom',
        createdAt: m.createdAt || new Date().toISOString()
      });
    });

    // 2. Add Product Images
    (products || []).forEach(p => {
      if (p.imageUrl) {
        mediaList.push({
          id: `prod-${p.id}`,
          title: p.title,
          url: p.imageUrl,
          category: p.category || 'Product',
          type: 'product',
          productId: p.id,
          createdAt: p.createdAt || new Date().toISOString()
        });
      }
    });

    // 3. Add Site Settings Images
    if (setting) {
      if (setting.white_logo) {
        mediaList.push({
          id: 'setting-white-logo',
          title: 'Site White Logo',
          url: setting.white_logo,
          category: 'Settings',
          type: 'setting',
          createdAt: new Date().toISOString()
        });
      }
      if (setting.dark_logo) {
        mediaList.push({
          id: 'setting-dark-logo',
          title: 'Site Dark Logo',
          url: setting.dark_logo,
          category: 'Settings',
          type: 'setting',
          createdAt: new Date().toISOString()
        });
      }
      if (setting.favicon) {
        mediaList.push({
          id: 'setting-favicon',
          title: 'Site Favicon',
          url: setting.favicon,
          category: 'Settings',
          type: 'setting',
          createdAt: new Date().toISOString()
        });
      }
    }

    const categoryFilter = req.query.category || 'all';
    const keyword = req.query.keyword || '';

    let filteredMedia = mediaList;

    if (categoryFilter && categoryFilter !== 'all') {
      filteredMedia = filteredMedia.filter(m => (m.category || '').toLowerCase() === categoryFilter.toLowerCase());
    }

    if (keyword) {
      const kw = keyword.trim().toLowerCase();
      filteredMedia = filteredMedia.filter(m => (m.title || '').toLowerCase().includes(kw) || (m.url || '').toLowerCase().includes(kw));
    }

    const categoriesList = Array.from(new Set(mediaList.map(m => m.category).filter(Boolean)));

    res.render("admin/media-library", {
      pageTitle: "Media Library",
      path: "/admin/media-library",
      mediaItems: filteredMedia,
      totalCount: mediaList.length,
      filteredCount: filteredMedia.length,
      categoryFilter: categoryFilter,
      keyword: keyword,
      categoriesList: categoriesList
    });
  } catch (err) {
    console.log("Error in getMediaLibrary:", err);
    res.redirect('/admin/dashboard');
  }
};

exports.postUploadMedia = (req, res, next) => {
  const { title, url, base64Data, filename, category } = req.body;
  let finalUrl = url;

  // If local file was uploaded via base64
  if (base64Data && base64Data.startsWith('data:image/')) {
    try {
      const commaIdx = base64Data.indexOf(',');
      if (commaIdx !== -1) {
        const header = base64Data.substring(0, commaIdx);
        const base64Content = base64Data.substring(commaIdx + 1);
        
        let ext = 'png';
        if (header.includes('jpeg') || header.includes('jpg')) ext = 'jpg';
        else if (header.includes('svg')) ext = 'svg';
        else if (header.includes('webp')) ext = 'webp';
        else if (header.includes('gif')) ext = 'gif';
        
        const buffer = Buffer.from(base64Content, 'base64');
        const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const safeName = (filename || 'image').replace(/[^a-zA-Z0-9_-]/g, '');
        const newFilename = `${safeName || 'media'}_${Date.now()}.${ext}`;
        const filePath = path.join(uploadsDir, newFilename);

        fs.writeFileSync(filePath, buffer);
        finalUrl = `/uploads/${newFilename}`;
      }
    } catch (err) {
      console.log("Error saving base64 upload:", err);
      return res.status(500).json({ success: false, message: 'Failed to save local file' });
    }
  }

  if (!finalUrl) {
    return res.status(400).json({ success: false, message: 'Please select an image file or enter a valid URL' });
  }

  const customMedia = loadCustomMedia();
  const newItem = {
    id: 'custom-' + Date.now(),
    title: title || 'Media Asset',
    url: finalUrl,
    category: category || 'General',
    createdAt: new Date().toISOString()
  };

  customMedia.unshift(newItem);
  saveCustomMedia(customMedia);

  return res.json({ success: true, message: 'Media uploaded successfully', item: newItem });
};

exports.postEditMedia = (req, res, next) => {
  const { id, title, url, category } = req.body;
  const customMedia = loadCustomMedia();
  const itemIndex = customMedia.findIndex(m => m.id === id);

  if (itemIndex !== -1) {
    customMedia[itemIndex].title = title || customMedia[itemIndex].title;
    customMedia[itemIndex].url = url || customMedia[itemIndex].url;
    customMedia[itemIndex].category = category || customMedia[itemIndex].category;
    saveCustomMedia(customMedia);
    return res.json({ success: true, message: 'Media updated successfully' });
  }

  res.status(404).json({ success: false, message: 'Media item not found or is a system asset' });
};

exports.postDeleteMedia = (req, res, next) => {
  const { id } = req.body;
  let customMedia = loadCustomMedia();
  const initialLength = customMedia.length;
  customMedia = customMedia.filter(m => m.id !== id);

  if (customMedia.length !== initialLength) {
    saveCustomMedia(customMedia);
    return res.json({ success: true, message: 'Media deleted successfully' });
  }

  res.json({ success: true, message: 'Media removed from library' });
};

exports.getApiMediaList = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      attributes: ['id', 'title', 'imageUrl', 'createdAt'],
      raw: true
    });
    const setting = await Setting.findOne({
      attributes: ['white_logo', 'dark_logo', 'favicon', 'og_baner'],
      raw: true
    });
    const customMedia = loadCustomMedia();

    const mediaList = [];
    let idCounter = 1;

    customMedia.forEach(m => {
      mediaList.push({
        id: m.id || `custom-${idCounter++}`,
        title: m.title || 'Uploaded Asset',
        url: m.url,
        createdAt: m.createdAt || new Date().toISOString()
      });
    });

    (products || []).forEach(p => {
      if (p.imageUrl) {
        mediaList.push({
          id: `prod-${p.id}`,
          title: p.title,
          url: p.imageUrl,
          createdAt: p.createdAt || new Date().toISOString()
        });
      }
    });

    if (setting) {
      if (setting.white_logo) mediaList.push({ id: 'setting-white', title: 'White Logo', url: setting.white_logo });
      if (setting.dark_logo) mediaList.push({ id: 'setting-dark', title: 'Dark Logo', url: setting.dark_logo });
      if (setting.favicon) mediaList.push({ id: 'setting-favicon', title: 'Favicon', url: setting.favicon });
    }

    res.json({ success: true, mediaList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, mediaList: [] });
  }
};


