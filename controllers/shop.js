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
    let hotDeals = (products || []).filter(p => p.isHotDeal || p.hotDeal || (p.oldPrice && p.oldPrice > p.price));
    if (hotDeals.length < 8) {
      const existingIds = new Set(hotDeals.map(p => p.id));
      const remaining = (products || []).filter(p => !existingIds.has(p.id));
      hotDeals = [...hotDeals, ...remaining].slice(0, 8);
    } else {
      hotDeals = hotDeals.slice(0, 8);
    }
    
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

exports.getCart = (req, res, next) => {
  req.user.getCart()
    .then(cart => {
      return cart.getProducts()
        .then(products => {
          res.render("shop/cart", {
            pageTitle: "Cart",
            path: "/shop/cart",
            products: products,
          });
        })
    })
    .catch(error => { console.log('Error in shop controller, getCart {}', error) });
};

exports.postCart = (req, res, next) => {
  const productId = req.body.productId;
  let fetchedCart;
  let newQuantity = 1;

  req.user.getCart()
    .then(cart => {
      fetchedCart = cart;
      return cart.getProducts({ where: { id: productId } })
    })
    .then(products => {
      let product;
      if (products.length > 0) {
        product = products[0];
      }
      if (product) {
        newQuantity = product.cartItem.quantity + 1;
        return product;
      }
      return Product.findByPk(productId);
    })
    .then(product => {
      return fetchedCart.addProduct(product, {
        through: { quantity: newQuantity }
      })
    })
    .then(() => {
      res.redirect("/cart");
    })
    .catch(error => console.log(error));
  
};

exports.postCartDeleteProduct = (req, res, next) => {
  const productId = req.body.productId;
  req.user.getCart()
    .then(cart => {
      return cart.getProducts({ where: { id: productId } })
    })
    .then(products => {
      const product = products[0];
      return product.cartItem.destroy();
    })
    .then(result => {
      res.redirect("/cart");
    })
    .catch(error => console.log(error));
};

exports.postCartUpdateQty = (req, res, next) => {
  const productId = req.body.productId;
  const newQty = parseInt(req.body.quantity);
  
  if (!productId || isNaN(newQty) || newQty < 1) {
    return res.status(400).json({ success: false, message: 'Invalid payload' });
  }

  req.user.getCart()
    .then(cart => {
      return cart.getProducts({ where: { id: productId } });
    })
    .then(products => {
      if (products.length === 0) {
        return res.status(404).json({ success: false, message: 'Product not in cart' });
      }
      const product = products[0];
      product.cartItem.quantity = newQty;
      return product.cartItem.save();
    })
    .then(() => {
      res.json({ success: true, message: 'Quantity updated' });
    })
    .catch(error => {
      console.log('Error updating cart quantity: ', error);
      res.status(500).json({ success: false, error: error.message });
    });
};

exports.getOrders = (req, res, next) => {
  req.user
    .getOrders({include: [{ model: Product }]})
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => {
      console.log(err);
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: []
      });
    });
};

exports.postOrder = (req, res, next) => {
  const { name, phone, address, area, payment_method } = req.body;
  let fetchedCart;

  req.user
    .getCart()
    .then(cart => {
      fetchedCart = cart;
      return cart.getProducts();
    })
    .then(products => {
      if (products.length === 0) {
        return res.redirect('/cart');
      }
      return req.user
        .createOrder({
          name: name || 'Customer',
          phone: phone || '01700000000',
          address: address || 'Dhaka',
          area: area || '60',
          paymentMethod: payment_method || 'Cash On Delivery',
          status: 'Pending'
        })
        .then(order => {
          return order.addProducts(
            products.map(product => {
              product.orderItem = { quantity: product.cartItem.quantity };
              return product;
            })
          );
        })
        .catch(err => console.log(err));
    })
    .then(result => {
      return fetchedCart.setProducts(null);
    })
    .then(result => {
      res.redirect('/orders-success');
    })
    .catch(err => console.log(err));
};




