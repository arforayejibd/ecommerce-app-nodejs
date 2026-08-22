const Sequelize = require("sequelize");

const sequelize = new Sequelize(process.env.DB_SCHEMA_NAME, process.env.DB_USER_NAME, process.env.DB_USER_PASSWORD, {
  dialect: "mysql",
  host: process.env.DB_HOST_URL,
  logging: console.log,
  charset: "utf8mb4",
  pool: {
    max: 5,
    min: 0,
    acquire: 10000,
    idle: 10000
  },
  dialectOptions: {
    connectTimeout: 10000,
    charset: "utf8mb4"
  }
});

module.exports = sequelize;
