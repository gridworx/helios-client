/**
 * Contact Routes - External Contact Management
 *
 * CRUD operations for external contacts (vendors, clients, partners).
 * Contacts are email-only entries with no login capability.
 */

import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { contactService } from '../services/contact.service.js'
import { successResponse, errorResponse, notFoundResponse } from '../utils/response.js'
import { ErrorCode } from '../types/error-codes.js'
import { logger } from '../utils/logger.js'

const router = Router()

/**
 * @openapi
 * /contacts:
 *   get:
 *     summary: List contacts
 *     description: Get all contacts for the organization with pagination and filtering
 *     tags: [Contacts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, or company
 *       - in: query
 *         name: contactType
 *         schema:
 *           type: string
 *           enum: [vendor, client, partner, external]
 *       - in: query
 *         name: company
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, email, first_name, last_name, company]
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId
    if (!organizationId) {
      return errorResponse(res, ErrorCode.VALIDATION_ERROR, 'Organization ID required')
    }

    const filters = {
      search: req.query.search as string,
      contactType: req.query.contactType as string,
      company: req.query.company as string,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined
    }

    const pagination = {
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 50, 100),
      sortBy: req.query.sortBy as string || 'created_at',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
    }

    const result = await contactService.listContacts(organizationId, filters, pagination)

    return successResponse(res, result)
  } catch (error: any) {
    logger.error('Failed to list contacts', { error: error.message })
    return errorResponse(res, ErrorCode.INTERNAL_ERROR, error.message)
  }
})

/**
 * @openapi
 * /contacts/stats:
 *   get:
 *     summary: Get contact statistics
 *     description: Get aggregate statistics about contacts
 *     tags: [Contacts]
 *     security:
 *       - BearerAuth: []
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId
    if (!organizationId) {
      return errorResponse(res, ErrorCode.VALIDATION_ERROR, 'Organization ID required')
    }

    const stats = await contactService.getContactStats(organizationId)

    return successResponse(res, stats)
  } catch (error: any) {
    logger.error('Failed to get contact stats', { error: error.message })
    return errorResponse(res, ErrorCode.INTERNAL_ERROR, error.message)
  }
})

/**
 * @openapi
 * /contacts/export:
 *   get:
 *     summary: Export contacts
 *     description: Export contacts as CSV
 *     tags: [Contacts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contactType
 *         schema:
 *           type: string
 *           enum: [vendor, client, partner, external]
 */
router.get('/export', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId
    if (!organizationId) {
      return errorResponse(res, ErrorCode.VALIDATION_ERROR, 'Organization ID required')
    }

    const filters = {
      contactType: req.query.contactType as string,
      isActive: true
    }

    const contacts = await contactService.exportContacts(organizationId, filters)

    // Generate CSV
    const headers = ['Email', 'First Name', 'Last Name', 'Display Name', 'Company', 'Job Title', 'Department', 'Phone', 'Mobile', 'Type', 'Tags', 'Notes']
    const rows = contacts.map(c => [
      c.email,
      c.firstName || '',
      c.lastName || '',
      c.displayName || '',
      c.company || '',
      c.jobTitle || '',
      c.department || '',
      c.phone || '',
      c.mobile || '',
      c.contactType,
      (c.tags || []).join(';'),
      (c.notes || '').replace(/"/g, '""')
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv')
    return res.send(csv)
  } catch (error: any) {
    logger.error('Failed to export contacts', { error: error.message })
    return errorResponse(res, ErrorCode.INTERNAL_ERROR, error.message)
  }
})

/**
 * @openapi
 * /contacts/{id}:
 *   get:
 *     summary: Get a contact
 *     description: Get details of a specific contact
 *     tags: [Contacts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const contact = await contactService.getContact(req.params.id)

    if (!contact) {
      return notFoundResponse(res, 'Contact not found')
    }

    // Verify user has access to this contact's organization
    if (contact.organizationId !== req.user?.organizationId) {
      return notFoundResponse(res, 'Contact not found')
    }

    return successResponse(res, contact)
  } catch (error: any) {
    logger.error('Failed to get contact', { error: error.message })
    return errorResponse(res, ErrorCode.INTERNAL_ERROR, error.message)
  }
})

/**
 * @openapi
 * /contacts:
 *   post:
 *     summary: Create a contact
 *     description: Create a new external contact
 *     tags: [Contacts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               displayName:
 *                 type: string
 *               company:
 *                 type: string
 *               jobTitle:
 *                 type: string
 *               department:
 *                 type: string
 *               phone:
 *                 type: string
 *               mobile:
 *                 type: string
 *               notes:
 *                 type: string
 *               contactType:
 *                 type: string
 *                 enum: [vendor, client, partner, external]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId
    if (!organizationId) {
      return errorResponse(res, ErrorCode.VALIDATION_ERROR, 'Organization ID required')
    }

    const {
      email,
      firstName,
      lastName,
      displayName,
      company,
      jobTitle,
      department,
      phone,
      mobile,
      notes,
      contactType,
      customFields,
      tags
    } = req.body

    if (!email) {
      return errorResponse(res, ErrorCode.MISSING_REQUIRED_FIELD, 'Email is required')
    }

    const contact = await contactService.createContact({
      organizationId,
      email,
      firstName,
      lastName,
      displayName,
      company,
      jobTitle,
      department,
      phone,
      mobile,
      notes,
      contactType,
      customFields,
      tags,
      createdBy: req.user?.userId
    })

    return successResponse(res, contact, {}, 201)
  } catch (error: any) {
    logger.error('Failed to create contact', { error: error.message })
    return errorResponse(res, ErrorCode.VALIDATION_ERROR, error.message)
  }
})

/**
 * @openapi
 * /contacts/{id}:
 *   put:
 *     summary: Update a contact
 *     description: Update an existing contact
 *     tags: [Contacts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const contact = await contactService.getContact(req.params.id)

    if (!contact) {
      return notFoundResponse(res, 'Contact not found')
    }

    if (contact.organizationId !== req.user?.organizationId) {
      return notFoundResponse(res, 'Contact not found')
    }

    const {
      firstName,
      lastName,
      displayName,
      company,
      jobTitle,
      department,
      phone,
      mobile,
      notes,
      contactType,
      customFields,
      tags,
      isActive
    } = req.body

    const updated = await contactService.updateContact(req.params.id, {
      firstName,
      lastName,
      displayName,
      company,
      jobTitle,
      department,
      phone,
      mobile,
      notes,
      contactType,
      customFields,
      tags,
      isActive
    })

    return successResponse(res, updated)
  } catch (error: any) {
    logger.error('Failed to update contact', { error: error.message })
    return errorResponse(res, ErrorCode.VALIDATION_ERROR, error.message)
  }
})

/**
 * @openapi
 * /contacts/{id}:
 *   delete:
 *     summary: Delete a contact
 *     description: Delete an external contact
 *     tags: [Contacts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const contact = await contactService.getContact(req.params.id)

    if (!contact) {
      return notFoundResponse(res, 'Contact not found')
    }

    if (contact.organizationId !== req.user?.organizationId) {
      return notFoundResponse(res, 'Contact not found')
    }

    await contactService.deleteContact(req.params.id)

    return successResponse(res, { message: 'Contact deleted successfully' })
  } catch (error: any) {
    logger.error('Failed to delete contact', { error: error.message })
    return errorResponse(res, ErrorCode.VALIDATION_ERROR, error.message)
  }
})

/**
 * @openapi
 * /contacts/import:
 *   post:
 *     summary: Import contacts
 *     description: Bulk import contacts from array
 *     tags: [Contacts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contacts]
 *             properties:
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [email]
 *                   properties:
 *                     email:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     company:
 *                       type: string
 *                     contactType:
 *                       type: string
 */
router.post('/import', requireAuth, requireAdmin, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId
    if (!organizationId) {
      return errorResponse(res, ErrorCode.VALIDATION_ERROR, 'Organization ID required')
    }

    const { contacts } = req.body

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return errorResponse(res, ErrorCode.VALIDATION_ERROR, 'Contacts array is required')
    }

    if (contacts.length > 1000) {
      return errorResponse(res, ErrorCode.VALIDATION_ERROR, 'Maximum 1000 contacts per import')
    }

    const result = await contactService.importContacts(
      organizationId,
      contacts,
      req.user?.userId
    )

    return successResponse(res, result)
  } catch (error: any) {
    logger.error('Failed to import contacts', { error: error.message })
    return errorResponse(res, ErrorCode.VALIDATION_ERROR, error.message)
  }
})

export default router
