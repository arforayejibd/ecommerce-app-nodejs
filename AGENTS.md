# Project Guidelines, Architecture Standards & Historical Log for AI Agents (One Commerce)

This document serves as the authoritative source of rules, architecture standards, historical bugfixes, and implementation guidelines for any AI Agent working on this project (**ecommerce-app-nodejs / One Commerce**). All AI Agents must read and adhere to these guidelines before making any changes to the codebase.

---

## 1. Project Overview & Technology Stack
- **Framework**: Node.js with Express.js
- **Database / ORM**: Sequelize ORM with MySQL / SQLite (`util/database.js`)
- **Templating Engine**: EJS views located in `views/`
- **Styling**: Custom Vanilla CSS located in `public/css/main.css` and `public/frontEnd/`
- **Deployment**: Automatic SFTP deployment via `node deploy.js` to cPanel host

---

## 2. Core Architectural Rules & Historical Bugfixes (DO NOT REVERT)

### A. Storefront Internationalization & Translation System
- **Language State**: Managed via `siteSettings.language` (`'bn'` or `'en'`).
- **Translation Helper**: `res.locals.__` defined in `app.js` with comprehensive English (`en`) and Bangla (`bn`) dictionaries.
- **CRITICAL RULE - Dynamic Data vs Static UI Labels**:
  - **Dynamic DB Fields**: User-generated database fields (e.g., `cat.name`, `categoryName`, `product.title`, `product.description`) MUST remain **RAW and UNTOUCHED** by the translation helper (`<%= cat.name %>`).
  - **Static UI Labels**: Only hardcoded UI labels (e.g., "Order Now", "Buy Now", "Subtotal", "Delivery Charge", "Discount", "Advance", "Free Delivery", "Track Order", "Cart", "Checkout") MUST be wrapped with `__('Key')`.
- **Language Switch**: Modifying language in Admin Settings (`views/admin/settings.ejs`) updates `settings.language` and updates site-wide labels seamlessly.

### B. System-Wide Invoice ID Standard
- **Format**: Across Admin Panel, Invoices, Order Success (`/orders-success`), and Order Tracking (`/order-track`), the official Invoice ID format is strictly `#INV-` + `order.id` (e.g., `#INV-13`).
- **Order Creation**: `postOrder` in `controllers/shop.js` saves `invoiceId = 'INV-' + order.id`.
- **Order Tracking Lookup**: `getOrderTrack` in `controllers/shop.js` cleans input digits and queries database by `id: parseInt(cleanDigits)`. Never change tracking logic to rely purely on random strings.

### C. Order Success Page (`/orders-success`) Logic
- **Target Order Resolution**: `getOrders` in `controllers/shop.js` retrieves the targeted order by `req.query.orderId` or picks `orders[0]` (newest order). DO NOT change this back to `orders[orders.length - 1]` (which incorrectly picked the oldest historical order).
- **Redirection**: `postOrder` redirects to `/orders-success?orderId=` + `order.id`.

### D. Financial & Breakdown Calculations
- **Formula**: `totalAmount = subtotal + shippingCharge - discount - advance`.
- **Breakdown Presentation**: On both `/orders-success` and `/order-track`:
  - **Subtotal**: Sum of product items `price * quantity`.
  - **Delivery Charge**: `order.shippingCharge` (defaults to area rate 60/120).
  - **Discount**: `order.discount` (Render row if `discount > 0`).
  - **Advance**: `order.advance` (Render row if `advance > 0`).
  - **Total Amount**: `order.totalAmount`.

### E. Responsive UI & Free Delivery Badge Layout Guidelines
- **Free Delivery Badge (`.free-delivery-badge`)**:
  - **Desktop (`> 768px`)**: Rendered over top-right of product image (`.desktop-only-badge`).
  - **Mobile (`<= 768px`)**: Rendered inside `.pro_des` right above the product title (`.mobile-only-badge`) so it never overlaps the sale discount badge (`-45%`) over the product image.
- **Product Detail Mobile Sticky Bar**: Must render dynamic single-product price and Order Now button on small screens (`<= 768px`).

---

## 3. Comprehensive Summary of Accomplished Features & Fixes
1. **Full Multilingual Translation**:
   - Integrated `res.locals.__` across `navigation.ejs`, `add-to-cart.ejs`, `index.ejs`, `product-detail.ejs`, `cart.ejs`, `product-list.ejs`, `orders.ejs`, `order-track.ejs`, and `footer.ejs`.
2. **Order Success Page Fix**:
   - Fixed oldest order bug; order breakdown now dynamically displays real subtotal, delivery fee, discount, advance, and grand total for the current checkout order.
3. **Invoice ID Standardization**:
   - Standardized `#INV-<id>` format across Admin orders, storefront tracking, order success, and print invoices.
4. **Order Tracking Page Breakdown**:
   - Added discount and advance rows with Bengali/English support on `/order-track`.
5. **Mobile Free Delivery Badge Positioning**:
   - Moved mobile Free Delivery badge above product title inside `.pro_des` to prevent overlap with discount badges on mobile devices while keeping desktop image badge intact.

---

## 4. Mandatory Deployment Workflow
Whenever changes are made and verified locally:
1. **Stage & Commit**: Run `git add .` and `git commit -m "Descriptive commit message"`.
2. **Push to Remote**: Run `git push origin main`.
3. **Deploy to Live Server**: Run `node deploy.js` to upload modified files via SFTP and touch `tmp/restart.txt` to restart the live Node.js server.

---

## 5. Strict Behavioral Rules for AI Agents
1. **No Guesswork**: Always inspect actual source files using file viewing tools before making edits.
2. **No Breaking Changes / Reversions**: Never alter existing API contracts, model schemas, route paths, or revert previously fixed features listed in Section 2 & 3 without explicit approval.
3. **Preserve Database Integrity**: Never mutate or delete user database records or tables during migrations.
4. **Empirical Local Verification**: Always verify local node server execution (`node app.js` on port 3000) after editing templates or controllers.
