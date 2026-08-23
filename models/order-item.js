const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const OrderItem = sequelize.define('orderItem', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  quantity: Sequelize.INTEGER,
  orderId: {
    type: Sequelize.INTEGER,
    allowNull: true
  },
  productId: {
    type: Sequelize.INTEGER,
    allowNull: true
  }
});

module.exports = OrderItem;