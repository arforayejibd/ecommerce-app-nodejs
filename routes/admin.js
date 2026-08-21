const path = require("path");
const adminController = require("../controllers/admin");
const isAdmin = require("../middleware/is-admin");

const express = require("express");

const router = express.Router();

// Public Admin Login routes
router.get("/login", adminController.getLogin);
router.post("/login", adminController.postLogin);
router.post("/logout", adminController.postLogout);

// Protected Main Dashboard
router.get("/dashboard", isAdmin, adminController.getDashboard);

// Protected Orders Routes
router.get("/orders", isAdmin, adminController.getAdminOrders);
router.get("/order/invoice/:invoiceId", isAdmin, adminController.getInvoice);
router.get("/order/edit/:invoiceId", isAdmin, adminController.getProcessOrder);
router.post("/order/edit", isAdmin, adminController.postProcessOrder);
router.get("/order/process/:invoiceId", isAdmin, adminController.getProcessOrder);
router.post("/order/process", isAdmin, adminController.postProcessOrder);
router.get("/orders/fraud-check", isAdmin, adminController.getFraudCheck);
router.post("/orders/print", isAdmin, adminController.postPrintOrders);
router.post("/orders/steadfast-courier", isAdmin, adminController.postSteadfastCourier);
router.post("/orders/pathao-courier", isAdmin, adminController.postPathaoCourier);
router.get("/order/:slug", isAdmin, adminController.getAdminOrders);

router.post("/orders/change-status", isAdmin, adminController.postChangeOrderStatus);
router.post("/orders/assign-user", isAdmin, adminController.postAssignAdminUser);
router.post("/orders/delete-bulk", isAdmin, adminController.postDeleteOrdersBulk);

// Protected Product & Catalog Management
router.get("/product-list", isAdmin, adminController.getProducts);
router.get("/products/manage", isAdmin, adminController.getProducts);
router.get("/add-product", isAdmin, adminController.getAddProduct);
router.post("/add-product", isAdmin, adminController.postAddProduct);
router.get("/edit-product/:productId", isAdmin, adminController.getEditProduct);
router.post("/edit-product", isAdmin, adminController.postEditProduct);
router.post("/delete-product", isAdmin, adminController.deleteProduct);
router.post("/products/delete-bulk", isAdmin, adminController.postDeleteProductsBulk);
router.post("/products/toggle-deals", isAdmin, adminController.postToggleProductsDeal);
router.post("/products/toggle-single-deal", isAdmin, adminController.postToggleSingleHotDeal);
router.post("/products/toggle-status", isAdmin, adminController.postToggleProductsStatus);

router.get("/categories", isAdmin, adminController.getCategories);
router.get("/categories/manage", isAdmin, adminController.getCategories);
router.get("/subcategories/manage", isAdmin, adminController.getCategories);
router.get("/childcategories/manage", isAdmin, adminController.getCategories);
router.get("/brands/manage", isAdmin, adminController.getCategories);
router.get("/color/manage", isAdmin, adminController.getCategories);
router.get("/size/manage", isAdmin, adminController.getCategories);

router.post("/category/create", isAdmin, adminController.postCreateCategory);
router.post("/category/edit", isAdmin, adminController.postEditCategory);
router.post("/category/status", isAdmin, adminController.postToggleCategoryStatus);
router.post("/category/delete", isAdmin, adminController.postDeleteCategory);

router.post("/subcategory/create", isAdmin, adminController.postCreateSubCategory);
router.post("/subcategory/edit", isAdmin, adminController.postEditSubCategory);
router.post("/subcategory/delete", isAdmin, adminController.postDeleteSubCategory);
router.get("/api/subcategories/:categoryId", isAdmin, adminController.getApiSubcategories);

router.get("/products/price-edit", isAdmin, adminController.getQuickPriceEdit);

// Protected Banners & Banner Categories
router.get("/banner-category/manage", isAdmin, adminController.getBannerCategories);
router.post("/banner-category/create", isAdmin, adminController.postCreateBannerCategory);
router.post("/banner-category/edit", isAdmin, adminController.postEditBannerCategory);
router.post("/banner-category/status", isAdmin, adminController.postToggleBannerCategoryStatus);
router.post("/banner-category/delete", isAdmin, adminController.postDeleteBannerCategory);

router.get("/banner/manage", isAdmin, adminController.getBanners);
router.get("/banner-settings", isAdmin, adminController.getBanners);
router.post("/banner/create", isAdmin, adminController.postCreateBanner);
router.post("/banner/edit", isAdmin, adminController.postEditBanner);
router.post("/banner/status", isAdmin, adminController.postToggleBannerStatus);
router.post("/banner/delete", isAdmin, adminController.postDeleteBanner);

router.get("/campaign/create", isAdmin, adminController.getCreateCampaign);
router.get("/campaign/manage", isAdmin, adminController.getManageCampaigns);

// Protected Users & Roles
router.get("/users/manage", isAdmin, adminController.getAdminUsers);
router.get("/roles/manage", isAdmin, adminController.getRoles);
router.get("/permissions/manage", isAdmin, adminController.getPermissions);
router.get("/customer", isAdmin, adminController.getCustomers);

// Protected Settings
router.get("/settings", isAdmin, adminController.getSettings);
router.get("/settings/manage", isAdmin, adminController.getSettings);
router.post("/settings", isAdmin, adminController.postSettings);
router.get("/social-media/manage", isAdmin, adminController.getSocialMedia);
router.get("/contact/manage", isAdmin, adminController.getContactInfo);
router.get("/page/manage", isAdmin, adminController.getCustomPages);
router.get("/shipping-charge/manage", isAdmin, adminController.getShippingCharges);
router.get("/orderstatus/manage", isAdmin, adminController.getOrderStatuses);

// Protected API Integrations
router.get("/paymentgeteway/manage", isAdmin, adminController.getPaymentGateways);
router.post("/paymentgeteway/update", isAdmin, adminController.postPaymentGatewayUpdate);

router.get("/smsgeteway/manage", isAdmin, adminController.getSmsGateways);
router.post("/smsgeteway/update", isAdmin, adminController.postSmsGatewayUpdate);

router.get("/courierapi/manage", isAdmin, adminController.getCourierApis);
router.post("/courierapi/update", isAdmin, adminController.postCourierApiUpdate);

// Protected Pixel & Tag Manager
router.get("/tag-manager/manage", isAdmin, adminController.getTagManager);
router.post("/tag-manager/update", isAdmin, adminController.postTagManagerUpdate);

router.get("/pixels/manage", isAdmin, adminController.getPixelManager);
router.post("/pixels/update", isAdmin, adminController.postPixelManagerUpdate);

// Protected Media Library
router.get("/media-library", isAdmin, adminController.getMediaLibrary);
router.get("/api/media-list", isAdmin, adminController.getApiMediaList);
router.post("/media/upload", isAdmin, adminController.postUploadMedia);
router.post("/media/edit", isAdmin, adminController.postEditMedia);
router.post("/media/delete", isAdmin, adminController.postDeleteMedia);

module.exports = router;
