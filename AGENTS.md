# Project Guidelines & Rules for AI Agents (One Commerce)

This document serves as the authoritative source of rules, architecture standards, and implementation guidelines for any AI Agent working on this project (**ecommerce-app-nodejs / One Commerce**). All AI Agents must read and adhere to these guidelines before making any changes to the codebase.

---

## 1. Project Overview & Technology Stack
- **Framework**: Node.js with Express.js
- **Database / ORM**: Sequelize ORM with MySQL / SQLite (`util/database.js`)
- **Templating Engine**: EJS views located in `views/`
- **Styling**: Custom Vanilla CSS located in `public/css/main.css` and `public/frontEnd/`
- **Deployment**: Automatic SFTP deployment via `node deploy.js` to cPanel host

---

## 2. Core Architectural & Business Rules

### A. Storefront Internationalization & Translation System
- **Language State**: Managed via `siteSettings.language` (`'bn'` or `'en'`).
- **Translation Helper**: `res.locals.__` defined in `app.js` with comprehensive English (`en`) and Bangla (`bn`) dictionaries.
- **CRITICAL RULE - Dynamic Data vs Static UI Labels**:
  - **Dynamic DB Fields**: User-generated database fields (e.g., `cat.name`, `categoryName`, `product.title`, `product.description`) MUST remain **RAW and UNTOUCHED** by the translation helper (`<%= cat.name %>`).
  - **Static UI Labels**: Only hardcoded UI labels (e.g., "Order Now", "Buy Now", "Subtotal", "Delivery Charge", "Discount", "Advance", "Free Delivery", "Track Order", "Cart") MUST be wrapped with `__('Key')`.

### B. System-Wide Invoice ID Standard
- **Format**: Across Admin Panel, Invoices, Order Success (`/orders-success`), and Order Tracking (`/order-track`), the official Invoice ID format is strictly `#INV-` + `order.id` (e.g., `#INV-13`).
- **Order Tracking Lookup**: `getOrderTrack` cleans input digits and queries database by `id: parseInt(cleanDigits)`.

### C. Financial & Order Calculations
- **Order Breakdown**:
  - **Subtotal**: Sum of `item.price * item.quantity`
  - **Delivery Charge**: `order.shippingCharge` (defaults to area charge 60/120)
  - **Discount**: `order.discount` (Render row if `discount > 0`)
  - **Advance**: `order.advance` (Render row if `advance > 0`)
  - **Total Amount**: `subtotal + shippingCharge - discount - advance`

### D. Responsive UI & Mobile Badge Guidelines
- **Free Delivery Badge (`.free-delivery-badge`)**:
  - **Desktop (`> 768px`)**: Rendered over top-right of product image (`.desktop-only-badge`).
  - **Mobile (`<= 768px`)**: Rendered inside `.pro_des` right above the product title (`.mobile-only-badge`) so it never overlaps the sale discount badge (`-45%`) over the product image.
- **Product Detail Mobile Sticky Bar**: Must render dynamic single-product price and Order Now button on small screens.

---

## 3. Mandatory Deployment Workflow
Whenever changes are made and verified locally:
1. **Stage & Commit**: Run `git add .` and `git commit -m "Descriptive commit message"`.
2. **Push to Remote**: Run `git push origin main`.
3. **Deploy to Live Server**: Run `node deploy.js` to upload modified files via SFTP and touch `tmp/restart.txt` to restart the live Node.js server.

---

## 4. Strict Behavioral Rules for AI Agents
1. **No Guesswork**: Always inspect actual source files using file viewing tools before making edits.
2. **No Breaking Changes**: Never alter existing API contracts, model schemas, or route paths without explicit approval.
3. **Preserve Database Integrity**: Never mutate or delete user database records or tables during migrations.
4. **Empirical Local Verification**: Always verify local node server execution (`node app.js` on port 3000) after editing templates or controllers.
