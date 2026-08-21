# Node.js E-commerce Application

This is an e-commerce store application built using Node.js, Express.js, and EJS. The application follows the MVC (Model-View-Controller) architecture and integrates RESTful APIs for efficient data handling. The application features dynamic routing, robust database interactions through Sequelize ORM, role-based user authentication, admin-driven product management, and customer-focused shopping cart functionalities.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Database Configuration](#database-configuration)
- [Running the Application](#running-the-application)
- [Contributing](#contributing)
- [License](#license)

## Features

- Role-based user authentication and authorization
- Admin-driven product management
- Customer-focused shopping cart functionality
- Order management system
- Dynamic routing and views rendered using EJS
- Integration with MySQL database using Sequelize ORM
- Logging with Morgan and request compression with compression
- MVC architecture for clean and maintainable codebase

## Technologies Used

- Node.js
- Express.js
- EJS (Embedded JavaScript templating)
- Sequelize ORM
- MySQL (AWS RDS)
- Morgan (HTTP request logger middleware)
- Compression (Gzip compression middleware)

## Prerequisites

- Node.js installed on your machine
- MySQL database (AWS RDS recommended)
- Git for version control

## Installation

1. Clone the repository to your local machine:

    ```bash
    git clone https://github.com/LahiruSen/book-store-nodejs.git
    ```

2. Navigate to the project directory:

    ```bash
    cd book-store-nodejs
    ```

3. Install the required dependencies:

    ```bash
    npm install
    ```

## Usage

1. Create a `.env` file in the root directory of your project and configure your environment variables:

    ```plaintext
    DB_NAME=your_db_name
    DB_USER=your_db_user
    DB_PASSWORD=your_db_password
    DB_HOST=your_db_host
    DB_DIALECT=mysql
    PORT=5000
    ```

2. Set up your MySQL database and update the configuration in the `util/database.js` file accordingly.

3. Run the application:

    ```bash
    npm start
    ```

4. The application should now be running on `http://localhost:5000`.

## Project Structure

```plaintext
nodejs-ecommerce-app/
│
├── controllers/
│   ├── admin.js
│   ├── error.js
│   └── shop.js
│
├── models/
│   ├── cart-item.js
│   ├── cart.js
│   ├── order-item.js
│   ├── order.js
│   ├── product.js
│   └── user.js
│
├── public/
│   ├── css/
│   ├── js/
│   └── images/
│
├── routes/
│   ├── admin.js
│   └── shop.js
│
├── views/
│   ├── admin/
│   ├── shop/
│   ├── includes/
│   └── error/
│
├── util/
│   ├── database.js
│
├── app.js
├── package.json
├── .env
└── README.md
```

## Database Configuration

The application uses Sequelize ORM for database interactions. The database configuration is specified in the `util/database.js` file. Make sure to update this file with your MySQL database credentials.

```javascript
const Sequelize = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  dialect: process.env.DB_DIALECT,
  host: process.env.DB_HOST
});

module.exports = sequelize;
```


## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements, bug fixes, or new features.

1. Fork the repository
2. Create a new branch (`git checkout -b feature-branch`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature-branch`)
5. Create a new pull request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Acknowledgements

This project was created by referring to the video guides provided by the Udemy course, [NodeJS - The Complete Guide (MVC, REST APIs, GraphQL, Deno)](https://www.udemy.com/course/nodejs-the-complete-guide), instructed by Maximilian Schwarzmüller. It is a great course that offers in-depth knowledge and practical insights into Node.js and its related technologies. Special thanks to Maximilian Schwarzmüller for his excellent tutorials and guidance.

Feel free to reach out if you have any questions or suggestions. Happy coding!



