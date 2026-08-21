const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const Order = sequelize.define('order', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  invoiceId: {
    type: Sequelize.STRING,
    allowNull: true
  },
  name: {
    type: Sequelize.STRING,
    allowNull: true
  },
  phone: {
    type: Sequelize.STRING,
    allowNull: true
  },
  address: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  area: {
    type: Sequelize.STRING,
    allowNull: true
  },
  paymentMethod: {
    type: Sequelize.STRING,
    allowNull: true,
    defaultValue: 'Cash On Delivery'
  },
  status: {
    type: Sequelize.STRING,
    allowNull: true,
    defaultValue: 'Pending'
  },
  assignee: {
    type: Sequelize.STRING,
    allowNull: true,
    defaultValue: 'Super Admin'
  },
  adminNote: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  discount: {
    type: Sequelize.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  advance: {
    type: Sequelize.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  shippingCharge: {
    type: Sequelize.FLOAT,
    allowNull: true,
    defaultValue: 60
  },
  amount: {
    type: Sequelize.FLOAT,
    allowNull: true
  }
});

module.exports = Order;