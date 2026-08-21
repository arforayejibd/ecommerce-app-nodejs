const Sequelize = require("sequelize");

const sequelize = new Sequelize(process.env.DB_SCHEMA_NAME,process.env.DB_USER_NAME, process.env.DB_USER_PASSWORD, {
  dialect: "mysql",
  host: process.env.DB_HOST_URL,
});

module.exports = sequelize;
