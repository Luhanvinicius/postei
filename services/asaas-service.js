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
        'Content-Type': 'application/json',
        'User-Agent': 'YouTube-Automation/1.0'
      }
    });
    
    // Interceptor para log de requisições (apenas em desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      this.client.interceptors.request.use(request => {
        console.log('📤 Asaas API Request:', request.method?.toUpperCase(), request.url);
        return request;
      });
      
      this.client.interceptors.response.use(
        response => {
          console.log('✅ Asaas API Response:', response.status, response.config.url);
          return response;
        },
        error => {
          console.error('❌ Asaas API Error:', error.response?.status, error.response?.data || error.message);
          return Promise.reject(error);
        }
      );
    }
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
    // O formato pode variar, então verificamos múltiplas possibilidades
    const event = webhookData.event || webhookData.type || 'UNKNOWN';
    const payment = webhookData.payment || webhookData.data || webhookData;

    // Normalizar status do pagamento
    let normalizedStatus = payment?.status;
    if (normalizedStatus) {
      // Converter status do Asaas para nosso formato
      normalizedStatus = normalizedStatus.toUpperCase();
      if (normalizedStatus === 'RECEIVED' || normalizedStatus === 'CONFIRMED') {
        normalizedStatus = 'RECEIVED';
      } else if (normalizedStatus === 'OVERDUE' || normalizedStatus === 'VENCIDO') {
        normalizedStatus = 'OVERDUE';
      } else if (normalizedStatus === 'PENDING' || normalizedStatus === 'PENDENTE') {
        normalizedStatus = 'PENDING';
      }
    }

    return {
      event,
      paymentId: payment?.id || payment?.paymentId || payment?.asaasId,
      status: normalizedStatus || 'PENDING',
      value: payment?.value || payment?.amount,
      dueDate: payment?.dueDate || payment?.due_date,
      customerId: payment?.customer || payment?.customerId
    };
  }
}

module.exports = new AsaasService();

