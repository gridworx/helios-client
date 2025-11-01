import * as fs from 'fs';
import * as path from 'path';
import { faker } from '@faker-js/faker';

export class TestDataHelper {
  private fixturesPath: string;
  private tempFiles: string[] = [];

  constructor() {
    this.fixturesPath = path.join(__dirname, '../fixtures');

    // Ensure fixtures directory exists
    if (!fs.existsSync(this.fixturesPath)) {
      fs.mkdirSync(this.fixturesPath, { recursive: true });
    }
  }

  /**
   * Generate random user data
   */
  generateUser(overrides?: any): any {
    return {
      email: faker.internet.email().toLowerCase(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      password: 'TestPass123!',
      role: faker.helpers.arrayElement(['admin', 'manager', 'user']),
      department: faker.commerce.department(),
      jobTitle: faker.person.jobTitle(),
      phone: faker.phone.number(),
      ...overrides
    };
  }

  /**
   * Generate multiple users
   */
  generateUsers(count: number, overrides?: any): any[] {
    return Array.from({ length: count }, () => this.generateUser(overrides));
  }

  /**
   * Generate CSV content
   */
  generateCSV(data: any[], headers?: string[]): string {
    if (data.length === 0) return '';

    const csvHeaders = headers || Object.keys(data[0]);
    const csvRows = data.map(row =>
      csvHeaders.map(header => {
        const value = row[header] || '';
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );

    return [csvHeaders.join(','), ...csvRows].join('\n');
  }

  /**
   * Create temporary CSV file
   */
  async createCSVFile(filename: string, data: any[], headers?: string[]): Promise<string> {
    const csvContent = this.generateCSV(data, headers);
    const filePath = path.join(this.fixturesPath, 'temp', filename);

    // Ensure temp directory exists
    const tempDir = path.dirname(filePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    fs.writeFileSync(filePath, csvContent);
    this.tempFiles.push(filePath);

    console.log(`✅ Created CSV file: ${filename}`);
    return filePath;
  }

  /**
   * Get fixture file path
   */
  getFile(filename: string): string {
    return path.join(this.fixturesPath, filename);
  }

  /**
   * Create sample CSV files
   */
  async createSampleCSVs(): Promise<void> {
    // User import CSV
    const users = this.generateUsers(10);
    await this.createCSVFile('users_import.csv', users, [
      'email', 'firstName', 'lastName', 'password', 'role', 'department'
    ]);

    // User update CSV
    const updates = users.slice(0, 5).map(u => ({
      email: u.email,
      department: faker.commerce.department(),
      jobTitle: faker.person.jobTitle()
    }));
    await this.createCSVFile('users_update.csv', updates, [
      'email', 'department', 'jobTitle'
    ]);

    // Invalid CSV (missing required fields)
    const invalid = [
      { email: 'invalid@example.com' }, // Missing required fields
      { firstName: 'John', lastName: 'Doe' } // Missing email
    ];
    await this.createCSVFile('users_invalid.csv', invalid);

    console.log('✅ Sample CSV files created');
  }

  /**
   * Generate organization data
   */
  generateOrganization(overrides?: any): any {
    const companyName = faker.company.name();
    return {
      name: companyName,
      domain: faker.internet.domainName(),
      adminEmail: faker.internet.email().toLowerCase(),
      adminFirstName: faker.person.firstName(),
      adminLastName: faker.person.lastName(),
      adminPassword: 'AdminTest123!',
      industry: faker.company.buzzPhrase(),
      size: faker.helpers.arrayElement(['1-10', '11-50', '51-200', '201-500', '500+']),
      ...overrides
    };
  }

  /**
   * Generate group data
   */
  generateGroup(overrides?: any): any {
    return {
      name: faker.commerce.department() + ' Team',
      description: faker.lorem.sentence(),
      email: faker.internet.email().toLowerCase(),
      type: faker.helpers.arrayElement(['native', 'google_workspace', 'microsoft_365']),
      members: [],
      ...overrides
    };
  }

  /**
   * Generate ticket data
   */
  generateTicket(overrides?: any): any {
    return {
      subject: faker.lorem.sentence(),
      senderEmail: faker.internet.email().toLowerCase(),
      senderName: faker.person.fullName(),
      groupEmail: 'support@test.helios.local',
      priority: faker.helpers.arrayElement(['low', 'normal', 'high', 'urgent']),
      status: faker.helpers.arrayElement(['new', 'in_progress', 'pending', 'resolved']),
      content: faker.lorem.paragraphs(3),
      ...overrides
    };
  }

  /**
   * Generate bulk operation data
   */
  generateBulkOperation(type: string, count: number): any {
    switch (type) {
      case 'user_create':
        return this.generateUsers(count);
      case 'user_update':
        return this.generateUsers(count).map(u => ({
          email: u.email,
          department: u.department,
          jobTitle: u.jobTitle
        }));
      case 'user_delete':
        return this.generateUsers(count).map(u => ({ email: u.email }));
      case 'group_create':
        return Array.from({ length: count }, () => this.generateGroup());
      default:
        return [];
    }
  }

  /**
   * Generate test file
   */
  async createTestFile(filename: string, content: string): Promise<string> {
    const filePath = path.join(this.fixturesPath, 'temp', filename);

    // Ensure temp directory exists
    const tempDir = path.dirname(filePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    fs.writeFileSync(filePath, content);
    this.tempFiles.push(filePath);

    console.log(`✅ Created test file: ${filename}`);
    return filePath;
  }

  /**
   * Generate service account JSON
   */
  generateServiceAccountJSON(): any {
    return {
      type: 'service_account',
      project_id: 'test-project-12345',
      private_key_id: faker.string.alphanumeric(40),
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----',
      client_email: 'test-service-account@test-project-12345.iam.gserviceaccount.com',
      client_id: faker.string.numeric(21),
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs'
    };
  }

  /**
   * Clean up temporary files
   */
  async cleanup(): Promise<void> {
    for (const file of this.tempFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }

    // Clean temp directory
    const tempDir = path.join(this.fixturesPath, 'temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    this.tempFiles = [];
    console.log('✅ Temporary files cleaned up');
  }

  /**
   * Wait for condition
   */
  async waitFor(condition: () => boolean | Promise<boolean>, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await condition();
      if (result) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  }

  /**
   * Generate random delay
   */
  async randomDelay(min: number = 500, max: number = 2000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

export default TestDataHelper;