const express = require("express");
const router = express.Router();
const { body } = require('express-validator');
const ApiCategoryController = require("../controllers/category.controller");
const auth = require("../middleware/auth");
const { isAdmin } = require("../middleware/role");
const { validate } = require('../middleware/validator');
const { MESSAGE } = require('../constants/messages')
const { BASE_ENDPOINT } = require('../constants/endpoints')
const {upload} = require('../utils/multer');

// Route public
router.get(BASE_ENDPOINT.BASE, ApiCategoryController.getAll);

router.get(BASE_ENDPOINT.ADMIN_LIST, auth, isAdmin, ApiCategoryController.getAllByAdmin);

// Route với phân quyền admin
router.post(
 BASE_ENDPOINT.BASE, 
  auth, 
  isAdmin, 
  upload.single('image'),
  [
    body('name').notEmpty().withMessage(MESSAGE.VALIDATION.REQUIRED('Tên danh mục'))
  ],
  validate,
  ApiCategoryController.create
);

router.put(
  BASE_ENDPOINT.BY_ID, 
  auth, 
  isAdmin, 
  upload.single('image'),
  ApiCategoryController.update
);

router.delete(BASE_ENDPOINT.BY_ID, auth, isAdmin, ApiCategoryController.remove);

module.exports = router;