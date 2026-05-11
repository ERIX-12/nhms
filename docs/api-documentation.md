# API Documentation - Nyaika Hotel Management System

## Overview

The NHMS API is a RESTful API built with NestJS that provides comprehensive hotel management functionality. The API follows JSON:API specifications and includes authentication, authorization, rate limiting, and comprehensive error handling.

## Base URL

- **Development**: `http://localhost:3001/api/v1`
- **Production**: `https://api.nyaikahotel.com/api/v1`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Authentication Endpoints

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "RECEPTIONIST"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "expiresIn": "24h"
  }
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "jwt_refresh_token"
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <token>
```

## API Endpoints

### Hotels

#### Get All Hotels
```http
GET /hotels
Authorization: Bearer <token>
```

#### Create Hotel
```http
POST /hotels
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Nyaika Hotel",
  "address": "123 Hotel Street, Kampala, Uganda",
  "phone": "+256123456789",
  "email": "info@nyaikahotel.com",
  "starRating": 4,
  "amenities": ["WiFi", "Pool", "Restaurant", "Gym"]
}
```

#### Update Hotel
```http
PUT /hotels/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### Rooms

#### Get Available Rooms
```http
GET /rooms/available?checkIn=2024-01-15&checkOut=2024-01-17&adults=2&children=0
Authorization: Bearer <token>
```

#### Create Room
```http
POST /rooms
Authorization: Bearer <token>
Content-Type: application/json

{
  "roomNumber": "101",
  "floor": 1,
  "roomType": "DELUXE",
  "roomStyle": "King Bed",
  "bookingPrice": 150.00,
  "maxAdults": 2,
  "maxChildren": 1,
  "amenities": ["TV", "Mini Bar", "Safe"],
  "smokingAllowed": false
}
```

#### Update Room Status
```http
PATCH /rooms/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "OCCUPIED"
}
```

### Bookings

#### Create Booking
```http
POST /bookings
Authorization: Bearer <token>
Content-Type: application/json

{
  "guestId": "guest_id",
  "roomId": "room_id",
  "checkInDate": "2024-01-15T14:00:00Z",
  "checkOutDate": "2024-01-17T11:00:00Z",
  "adultsCount": 2,
  "childrenCount": 0,
  "specialRequests": "Late check-in requested"
}
```

#### Get Booking Details
```http
GET /bookings/:id
Authorization: Bearer <token>
```

#### Update Booking Status
```http
PATCH /bookings/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "CONFIRMED"
}
```

#### Check-in Guest
```http
POST /bookings/:id/checkin
Authorization: Bearer <token>
Content-Type: application/json

{
  "identityVerified": true,
  "roomKeyAssigned": true
}
```

#### Check-out Guest
```http
POST /bookings/:id/checkout
Authorization: Bearer <token>
```

### Guests

#### Create Guest
```http
POST /guests
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+256712345678",
  "address": "123 Guest Street",
  "nationalId": "CM12345678",
  "dateOfBirth": "1980-01-01",
  "gender": "MALE",
  "nationality": "UG"
}
```

#### Search Guests
```http
GET /guests/search?query=John&limit=10&page=1
Authorization: Bearer <token>
```

### Payments

#### Process Payment
```http
POST /payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "bookingId": "booking_id",
  "amount": 300.00,
  "method": "CREDIT_CARD",
  "gateway": "STRIPE",
  "transactionId": "txn_123456789"
}
```

#### Get Payment History
```http
GET /payments?bookingId=booking_id&limit=10&page=1
Authorization: Bearer <token>
```

#### Refund Payment
```http
POST /payments/:id/refund
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 50.00,
  "reason": "Guest cancellation"
}
```

### Invoices

#### Generate Invoice
```http
POST /invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "bookingId": "booking_id",
  "items": [
    {
      "description": "Room Charge - 2 nights",
      "quantity": 2,
      "unitPrice": 150.00
    },
    {
      "description": "Room Service",
      "quantity": 1,
      "unitPrice": 25.00
    }
  ]
}
```

#### Get Invoice PDF
```http
GET /invoices/:id/pdf
Authorization: Bearer <token>
```

### Housekeeping

#### Update Housekeeping Status
```http
PATCH /housekeeping/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "CLEANED",
  "notes": "Room cleaned and inspected"
}
```

#### Get Housekeeping Schedule
```http
GET /housekeeping/schedule?date=2024-01-15&status=PENDING
Authorization: Bearer <token>
```

### Employees

#### Create Employee
```http
POST /employees
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@nyaikahotel.com",
  "phone": "+256712345679",
  "position": "Housekeeper",
  "department": "Housekeeping",
  "hireDate": "2024-01-01",
  "salary": 800.00
}
```

#### Get Employee Schedule
```http
GET /employees/:id/schedule?startDate=2024-01-15&endDate=2024-01-21
Authorization: Bearer <token>
```

### Reports

#### Get Occupancy Report
```http
GET /reports/occupancy?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <token>
```

#### Get Revenue Report
```http
GET /reports/revenue?startDate=2024-01-01&endDate=2024-01-31&groupBy=day
Authorization: Bearer <token>
```

#### Get Booking Trends
```http
GET /reports/booking-trends?period=last-30-days
Authorization: Bearer <token>
```

## Error Responses

The API returns consistent error responses:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "details": {
    "errors": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/auth/login"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default**: 100 requests per 15 minutes per IP
- **Authenticated users**: 200 requests per 15 minutes
- **Admin users**: 500 requests per 15 minutes

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

## Pagination

List endpoints support pagination:

```http
GET /bookings?page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## Filtering and Search

Most list endpoints support filtering:

```http
GET /bookings?status=CONFIRMED&checkInDate=2024-01-15&guestId=guest_id
```

## Webhooks

The API supports webhooks for real-time notifications:

### Configure Webhook
```http
POST /webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://your-app.com/webhook",
  "events": ["booking.created", "booking.cancelled", "payment.received"],
  "secret": "webhook_secret"
}
```

### Webhook Events

- `booking.created` - New booking created
- `booking.updated` - Booking updated
- `booking.cancelled` - Booking cancelled
- `payment.received` - Payment received
- `guest.checked_in` - Guest checked in
- `guest.checked_out` - Guest checked out

## SDKs and Libraries

### JavaScript/TypeScript
```bash
npm install @nyaika/hms-sdk
```

```javascript
import { NHMSClient } from '@nyaika/hms-sdk';

const client = new NHMSClient({
  baseURL: 'https://api.nyaikahotel.com/api/v1',
  apiKey: 'your-api-key'
});

const bookings = await client.bookings.list();
```

### Python
```bash
pip install nyaika-hms-python
```

```python
from nyaika_hms import NHMSClient

client = NHMSClient(
    base_url='https://api.nyaikahotel.com/api/v1',
    api_key='your-api-key'
)

bookings = client.bookings.list()
```

## Testing

### Test Environment
- **URL**: `https://api-test.nyaikahotel.com/api/v1`
- **Test Credentials**: Contact support for test API keys

### Postman Collection
Download the Postman collection from: [NHMS API Postman Collection](https://docs.nyaikahotel.com/postman-collection)

## Support

- **Documentation**: https://docs.nyaikahotel.com
- **API Reference**: https://api.nyaikahotel.com/docs
- **Support Email**: api-support@nyaikahotel.com
- **Status Page**: https://status.nyaikahotel.com

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Core hotel management functionality
- Authentication and authorization
- Booking and payment processing
- Reporting and analytics

### v1.1.0 (2024-02-01)
- Added webhook support
- Enhanced filtering capabilities
- Performance improvements
- Bug fixes

### v1.2.0 (2024-03-01)
- Mobile app API endpoints
- Advanced reporting features
- Multi-language support
- Enhanced security features
