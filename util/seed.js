require('dotenv').config();
const sequelize = require('./database');
const Product = require('../models/product');
const User = require('../models/user');
const Cart = require('../models/cart');
const CartItem = require('../models/cart-item');
const Order = require('../models/order');
const OrderItem = require('../models/order-item');

Product.belongsTo(User, { constraints: true, onDelete: "CASCADE" });
User.hasMany(Product);
User.hasOne(Cart);
Cart.belongsTo(User);
Cart.belongsToMany(Product, { through: CartItem });
Product.belongsToMany(Cart, { through: CartItem });
Order.belongsTo(User);
User.hasMany(Order);
Order.belongsToMany(Product, { through: OrderItem });

const oneCommerceProducts = [
  {
    title: "1 STONE TRADITIONAL 18K GOLD NOSEPIN WHITE + FREE FINGER RING + FREE EARING",
    price: 399,
    oldPrice: 798,
    category: "Nosepin",
    isHotDeal: true,
    imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
    description: "Traditional 18K Gold Plated One Stone Nosepin White. Includes free matching Finger Ring and Earring gift set."
  },
  {
    title: "7 STONE TRADITIONAL 18K GOLD DIAMOND CUT NOSEPIN + FREE GIFTS",
    price: 699,
    oldPrice: 1280,
    category: "Nosepin",
    isHotDeal: true,
    imageUrl: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80",
    description: "7 Stone Sparkling 18K Gold Plated Diamond Cut Nosepin. Comes with gift box & additional finger ring."
  },
  {
    title: "Moissanite Diamond Ring (ময়েসানাইট ডায়মন্ড রিং) Silver",
    price: 950,
    oldPrice: 1650,
    category: "Ring",
    isHotDeal: true,
    imageUrl: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80",
    description: "Premium Silver Plated Moissanite Diamond Ring with brilliant shine and adjustable finger size."
  },
  {
    title: "Moissanite Diamond Ring (ময়েসানাইট ডায়মন্ড রিং) Silver Heart",
    price: 950,
    oldPrice: 1650,
    category: "Ring",
    isHotDeal: true,
    imageUrl: "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=800&q=80",
    description: "Heart Shaped Moissanite Diamond Ring. Elegant design for parties, weddings, and special occasions."
  },
  {
    title: "Moissanite Diamond Ring (ময়েসানাইট ডায়মন্ড রিং) Golden Heart",
    price: 950,
    oldPrice: 1650,
    category: "Ring",
    isHotDeal: false,
    imageUrl: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80",
    description: "Golden Heart Cut Moissanite Diamond Finger Ring. 18K Gold Electroplated with long lasting polish."
  },
  {
    title: "SWS Instant Water Purifier Mini",
    price: 650,
    oldPrice: 990,
    category: "Home Appliances",
    isHotDeal: true,
    imageUrl: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
    description: "SWS Faucet Mounted Instant Water Filter Purifier. Removes chlorine, heavy metals, rust, and bacteria from tap water."
  },
  {
    title: "2pcs Fridge Door Safety Lock",
    price: 680,
    oldPrice: 980,
    category: "Home Appliances",
    isHotDeal: false,
    imageUrl: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80",
    description: "Child Safety Fridge and Cabinet Door Lock set. Easy 3M adhesive installation without tools."
  },
  {
    title: "3Pcs Anti Paronychia Relief Oil – নখের ইনফেকশন ও পুঁজের জন্য রিলিফ অয়েল | 10ml",
    price: 750,
    oldPrice: 1190,
    category: "Health Appliances",
    isHotDeal: true,
    imageUrl: "https://images.unsplash.com/photo-1608248597263-00079e9603f9?auto=format&fit=crop&w=800&q=80",
    description: "Herbal anti-paronychia toe and fingernail relief oil set. Effective for infection, inflammation, and nail repair."
  },
  {
    title: "2Pcs Anti Paronychia Relief Oil – নখের ইনফেকশন ও পুঁজের জন্য রিলিফ অয়েল | 10ml",
    price: 490,
    oldPrice: 890,
    category: "Health Appliances",
    isHotDeal: false,
    imageUrl: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80",
    description: "2 Pack Anti Paronychia Relief Drops for quick relief from ingrown fingernails and toenail infections."
  }
];

async function seed() {
  try {
    console.log("Syncing database tables (force refresh)...");
    await sequelize.sync({ force: true });
    
    const user = await User.create({ name: "One Commerce Admin", email: "info@onecommercebd.com" });
    await user.createCart();
    console.log("Created user & cart.");
    
    console.log("Seeding One Commerce products...");
    for (const p of oneCommerceProducts) {
      await user.createProduct(p);
    }
    console.log(`Successfully seeded ${oneCommerceProducts.length} products!`);
    
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
}

seed();
