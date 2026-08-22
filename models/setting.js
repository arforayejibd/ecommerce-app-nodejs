const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const Setting = sequelize.define('setting', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  name: {
    type: Sequelize.STRING,
    defaultValue: "One Commerce"
  },
  phone: {
    type: Sequelize.STRING,
    defaultValue: "01700000000"
  },
  play_store: {
    type: Sequelize.STRING,
    defaultValue: "https://play.google.com/store/apps/details?id=com.onecommercebd.app"
  },
  status: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  },
  white_logo: {
    type: Sequelize.STRING,
    defaultValue: "https://www.onecommercebd.com/uploads/setting/white-logo.png"
  },
  dark_logo: {
    type: Sequelize.STRING,
    defaultValue: "https://www.onecommercebd.com/uploads/setting/dark-logo.png"
  },
  favicon: {
    type: Sequelize.STRING,
    defaultValue: "https://www.onecommercebd.com/uploads/setting/favicon.ico"
  },
  og_baner: {
    type: Sequelize.STRING,
    defaultValue: "https://www.onecommercebd.com/uploads/setting/white-logo.png"
  },
  primary_color: {
    type: Sequelize.STRING,
    defaultValue: "#6366f1"
  },
  secondary_color: {
    type: Sequelize.STRING,
    defaultValue: "#4f46e5"
  },
  delivery_inside: {
    type: Sequelize.INTEGER,
    defaultValue: 60
  },
  delivery_outside: {
    type: Sequelize.INTEGER,
    defaultValue: 120
  },
  meta_description: {
    type: Sequelize.TEXT,
    defaultValue: "One Commerce - Best online fashion and lifestyle store in Bangladesh offering quality products at affordable prices."
  },
  meta_keyword: {
    type: Sequelize.TEXT,
    defaultValue: "ecommerce, fashion, clothing, Bangladesh, online shopping, One Commerce"
  }
});

module.exports = Setting;
