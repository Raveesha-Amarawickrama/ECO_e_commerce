import express from 'express';
import { addCategory, gellAllCategory, deleteCategory, editCategory } from '../controller/categoryController.js';

const router = express.Router();

router.get('/', gellAllCategory);
router.post('/', addCategory);
router.patch('/:id', editCategory);
router.delete('/:id', deleteCategory);

export default router;