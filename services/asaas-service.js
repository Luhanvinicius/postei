/**
 * Serviço de integração com Asaas API
 * 
 * Para usar este serviço, configure a variável de ambiente:
 * ASAAS_API_KEY=sua_chave_api_aqui
 * ASAAS_ENVIRONMENT=production ou sandbox
 */

const axios = require('axios');

class AsaasService {
  constructor() {
    this.apiKey = process.env.ASAAS_API_KEY || '';
    this.environment = process.env.ASAAS_ENVIRONMENT || 'sandbox';
    this.baseURL = this.environment === 'production' 
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'access_token': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Verifica se a API key está configurada
   */
  isConfigured() {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Cria um cliente no Asaas
   * @param {Object} customerData - Dados do cliente
   * @returns {Promise<Object>}
   */
  async createCustomer(customerData) {
    if (!this.isConfigured()) {
      throw new Error('ASAAS_API_KEY não configurada. Configure a variável de ambiente ASAAS_API_KEY.');
    }

    try {
      const response = await this.client.post('/customers', {
        name: customerData.name,
        email: customerData.email,
        cpfCnpj: customerData.cpfCnpj,
        phone: customerData.phone,
        postalCode: customerData.postalCode,
        address: customerData.address,
        addressNumber: customerData.addressNumber,
        complement: customerData.complement,
        province: customerData.province,
        city: customerData.city,
        state: customerData.state
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Erro ao criar cliente no Asaas:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors || error.message
      };
    }
  }

  /**
   * Cria uma assinatura no Asaas
   * @param {Object} subscriptionData - Dados da assinatura
   * @returns {Promise<Object>}
   */
  async createSubscription(subscriptionData) {
    if (!this.isConfigured()) {
      throw new Error('ASAAS_API_KEY não configurada. Configure a variável de ambiente ASAAS_API_KEY.');
    }

    try {
      const response = await this.client.post('/subscriptions', {
        customer: subscriptionData.customerId,
        billingType: subscriptionData.billingType || 'PIX',
        value: subscriptionData.value,
        nextDueDate: subscriptionData.nextDueDate,
        cycle: subscriptionData.cycle || 'MONTHLY',
        description: subscriptionData.description,
        externalReference: subscriptionData.externalReference
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Erro ao criar assinatura no Asaas:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors || error.message
      };
    }
  }

  /**
   * Cria uma cobrança única (PIX/Boleto) no Asaas
   * @param {Object} paymentData - Dados do pagamento
   * @returns {Promise<Object>}
   */
  async createPayment(paymentData) {
    if (!this.isConfigured()) {
      throw new Error('ASAAS_API_KEY não configurada. Configure a variável de ambiente ASAAS_API_KEY.');
    }

    try {
      const response = await this.client.post('/payments', {
        customer: paymentData.customerId,
        billingType: paymentData.billingType || 'PIX',
        value: paymentData.value,
        dueDate: paymentData.dueDate,
        description: paymentData.description,
        externalReference: paymentData.externalReference
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Erro ao criar pagamento no Asaas:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors || error.message
      };
    }
  }

  /**
   * Busca informações de uma cobrança pelo ID
   * @param {String} paymentId - ID da cobrança no Asaas
   * @returns {Promise<Object>}
   */
  async getPayment(paymentId) {
    if (!this.isConfigured()) {
      throw new Error('ASAAS_API_KEY não configurada. Configure a variável de ambiente ASAAS_API_KEY.');
    }

    try {
      const response = await this.client.get(`/payments/${paymentId}`);

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Erro ao buscar pagamento no Asaas:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors || error.message
      };
    }
  }

  /**
   * Busca o QR Code PIX de uma cobrança
   * @param {String} paymentId - ID da cobrança no Asaas
   * @returns {Promise<Object>}
   */
  async getPixQrCode(paymentId) {
    if (!this.isConfigured()) {
      throw new Error('ASAAS_API_KEY não configurada. Configure a variável de ambiente ASAAS_API_KEY.');
    }

    try {
      const response = await this.client.get(`/payments/${paymentId}/pixQrCode`);

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Erro ao buscar QR Code PIX no Asaas:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors || error.message
      };
    }
  }

  /**
   * Webhook para processar notificações do Asaas
   * @param {Object} webhookData - Dados do webhook
   * @returns {Object}
   */
  processWebhook(webhookData) {
    // O Asaas envia eventos como: PAYMENT_CREATED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, etc.
    const event = webhookData.event;
    const payment = webhookData.payment;

    return {
      event,
      paymentId: payment?.id,
      status: payment?.status,
      value: payment?.value,
      dueDate: payment?.dueDate,
      customerId: payment?.customer
    };
  }
}

module.exports = new AsaasService();

