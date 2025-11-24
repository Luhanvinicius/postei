const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { plans, subscriptions, invoices } = require('../database');
const asaasService = require('../services/asaas-service');

// Página de seleção de plano (para usuários com pagamento pendente)
router.get('/select-plan', requireAuth, (req, res) => {
  res.redirect('/#planos');
});

// Página de pagamento pendente
router.get('/pending', requireAuth, async (req, res) => {
  try {
    const { invoice } = req.query;
    const userId = req.user.id;

    let invoiceData = null;
    if (invoice) {
      try {
        if (invoices && invoices.findById) {
          const isAsync = invoices.findById.constructor && invoices.findById.constructor.name === 'AsyncFunction';
          if (isAsync) {
            invoiceData = await invoices.findById(invoice);
          } else {
            invoiceData = invoices.findById(invoice);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar fatura:', err);
        if (invoices && invoices.findById) {
          invoiceData = invoices.findById(invoice);
        }
      }
    } else {
      // Buscar última fatura pendente do usuário
      let userInvoices = [];
      try {
        if (invoices && invoices.findByUserId) {
          const isAsync = invoices.findByUserId.constructor && invoices.findByUserId.constructor.name === 'AsyncFunction';
          if (isAsync) {
            userInvoices = await invoices.findByUserId(userId);
          } else {
            userInvoices = invoices.findByUserId(userId);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar faturas:', err);
        if (invoices && invoices.findByUserId) {
          userInvoices = invoices.findByUserId(userId);
        }
      }
      
      if (!Array.isArray(userInvoices)) {
        userInvoices = [];
      }
      
      invoiceData = userInvoices.find(inv => inv.status === 'pending');
    }

    res.render('payment/pending', {
      user: req.user,
      invoice: invoiceData
    });
  } catch (error) {
    console.error('Erro ao carregar página de pagamento pendente:', error);
    res.redirect('/#planos');
  }
});

// Página de checkout
router.get('/checkout/:planSlug', requireAuth, async (req, res) => {
  try {
    console.log('🔍 Acessando checkout:', req.params.planSlug);
    console.log('👤 Usuário:', req.user.username, 'Payment Status:', req.user.payment_status);
    
    const { planSlug } = req.params;
    const userId = req.user.id;

    // Buscar plano
    let plan;
    try {
      if (plans && plans.findBySlug) {
        const isAsync = plans.findBySlug.constructor && plans.findBySlug.constructor.name === 'AsyncFunction';
        if (isAsync) {
          plan = await plans.findBySlug(planSlug);
        } else {
          plan = plans.findBySlug(planSlug);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar plano:', err);
      if (plans && plans.findBySlug) {
        plan = plans.findBySlug(planSlug);
      }
    }

    if (!plan) {
      console.error('❌ Plano não encontrado:', planSlug);
      return res.redirect('/?error=plano_nao_encontrado');
    }

    console.log('✅ Plano encontrado:', plan.name);
    console.log('📄 Renderizando checkout...');
    
    res.render('payment/checkout', {
      user: req.user,
      plan: plan
    });
  } catch (error) {
    console.error('❌ Erro ao carregar checkout:', error);
    res.redirect('/?error=erro_carregar_checkout');
  }
});

// Processar checkout e gerar fatura
router.post('/checkout/:planSlug', requireAuth, async (req, res) => {
  try {
    const { planSlug } = req.params;
    const userId = req.user.id;
    const { 
      name, 
      email, 
      cpfCnpj, 
      phone, 
      postalCode, 
      address, 
      addressNumber, 
      complement, 
      province, 
      city, 
      state 
    } = req.body;

    // Validações básicas
    if (!name || !email || !cpfCnpj || !phone) {
      return res.json({ success: false, error: 'Preencha todos os campos obrigatórios' });
    }

    // Buscar plano
    let plan;
    try {
      if (plans.findBySlug.constructor.name === 'AsyncFunction') {
        plan = await plans.findBySlug(planSlug);
      } else {
        plan = plans.findBySlug(planSlug);
      }
    } catch (err) {
      plan = plans.findBySlug(planSlug);
    }

    if (!plan) {
      return res.json({ success: false, error: 'Plano não encontrado' });
    }

    // Verificar se Asaas está configurado
    if (!asaasService.isConfigured()) {
      return res.json({ 
        success: false, 
        error: 'Sistema de pagamento não configurado. Entre em contato com o suporte.' 
      });
    }

    // Criar cliente no Asaas
    const customerResult = await asaasService.createCustomer({
      name,
      email,
      cpfCnpj: cpfCnpj.replace(/\D/g, ''), // Remove formatação
      phone: phone.replace(/\D/g, ''),
      postalCode: postalCode?.replace(/\D/g, ''),
      address,
      addressNumber,
      complement,
      province,
      city,
      state
    });

    if (!customerResult.success) {
      return res.json({ success: false, error: 'Erro ao criar cliente: ' + JSON.stringify(customerResult.error) });
    }

    const asaasCustomerId = customerResult.data.id;

    // Calcular data de vencimento (3 dias a partir de hoje)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // Criar pagamento no Asaas
    const paymentResult = await asaasService.createPayment({
      customerId: asaasCustomerId,
      billingType: 'PIX',
      value: plan.price,
      dueDate: dueDateStr,
      description: `Assinatura ${plan.name} - YouTube Automation`,
      externalReference: `user_${userId}_plan_${plan.id}_${Date.now()}`
    });

    if (!paymentResult.success) {
      return res.json({ success: false, error: 'Erro ao criar pagamento: ' + JSON.stringify(paymentResult.error) });
    }

    const asaasPayment = paymentResult.data;

    // Buscar QR Code PIX
    const pixResult = await asaasService.getPixQrCode(asaasPayment.id);
    let pixQrCode = null;
    let pixCopyPaste = null;

    if (pixResult.success) {
      pixQrCode = pixResult.data.encodedImage;
      pixCopyPaste = pixResult.data.payload;
    }

    // Criar assinatura no banco
    let subscriptionId = null;
    try {
      if (subscriptions && subscriptions.create) {
        const isAsync = subscriptions.create.constructor && subscriptions.create.constructor.name === 'AsyncFunction';
        if (isAsync) {
          subscriptionId = await subscriptions.create(userId, plan.id, null);
        } else {
          subscriptionId = subscriptions.create(userId, plan.id, null);
        }
      }
    } catch (err) {
      console.error('Erro ao criar assinatura:', err);
      if (subscriptions && subscriptions.create) {
        subscriptionId = subscriptions.create(userId, plan.id, null);
      }
    }

    // Criar fatura no banco
    const invoiceNumber = `INV-${Date.now()}-${userId}`;
    let invoiceId;
    try {
      if (invoices && invoices.create) {
        const isAsync = invoices.create.constructor && invoices.create.constructor.name === 'AsyncFunction';
        if (isAsync) {
          invoiceId = await invoices.create(
            userId,
            plan.id,
            subscriptionId,
            plan.price,
            asaasPayment.id,
            invoiceNumber,
            dueDateStr,
            pixQrCode,
            pixCopyPaste
          );
        } else {
          invoiceId = invoices.create(
            userId,
            plan.id,
            subscriptionId,
            plan.price,
            asaasPayment.id,
            invoiceNumber,
            dueDateStr,
            pixQrCode,
            pixCopyPaste
          );
        }
      }
    } catch (err) {
      console.error('Erro ao criar fatura:', err);
      if (invoices && invoices.create) {
        invoiceId = invoices.create(
          userId,
          plan.id,
          subscriptionId,
          plan.price,
          asaasPayment.id,
          invoiceNumber,
          dueDateStr,
          pixQrCode,
          pixCopyPaste
        );
      }
    }

    res.json({
      success: true,
      invoiceId: invoiceId,
      pixQrCode: pixQrCode,
      pixCopyPaste: pixCopyPaste,
      dueDate: dueDateStr,
      message: 'Fatura gerada com sucesso! Redirecionando...'
    });
  } catch (error) {
    console.error('Erro ao processar checkout:', error);
    res.json({ success: false, error: 'Erro ao processar pagamento: ' + error.message });
  }
});

// Webhook do Asaas (sem autenticação)
router.post('/webhook/asaas', express.json(), async (req, res) => {
  try {
    console.log('📥 ===== WEBHOOK RECEBIDO DO ASAAS =====');
    console.log('📦 Body completo:', JSON.stringify(req.body, null, 2));
    console.log('🔍 Headers:', JSON.stringify(req.headers, null, 2));
    
    const webhookData = asaasService.processWebhook(req.body);
    
    console.log('📊 Dados processados:');
    console.log('   Event:', webhookData.event);
    console.log('   Payment ID:', webhookData.paymentId);
    console.log('   Status:', webhookData.status);
    console.log('   Value:', webhookData.value);
    
    if (!webhookData.paymentId) {
      console.warn('⚠️  Webhook sem paymentId, ignorando...');
      return res.status(200).json({ received: true, message: 'Webhook recebido mas sem paymentId' });
    }
    
    // Buscar fatura pelo ID do Asaas
    let invoice;
    try {
      if (invoices && invoices.findByAsaasId) {
        const isAsync = invoices.findByAsaasId.constructor && invoices.findByAsaasId.constructor.name === 'AsyncFunction';
        if (isAsync) {
          invoice = await invoices.findByAsaasId(webhookData.paymentId);
        } else {
          invoice = invoices.findByAsaasId(webhookData.paymentId);
        }
      }
    } catch (err) {
      console.error('❌ Erro ao buscar fatura:', err);
      if (invoices && invoices.findByAsaasId) {
        invoice = invoices.findByAsaasId(webhookData.paymentId);
      }
    }

    if (!invoice) {
      console.warn('⚠️  Fatura não encontrada para paymentId:', webhookData.paymentId);
      console.log('   Isso pode ser normal se o pagamento não foi criado pelo nosso sistema');
      return res.status(200).json({ received: true, message: 'Fatura não encontrada' });
    }

    console.log('✅ Fatura encontrada:', invoice.id);
    console.log('   User ID:', invoice.user_id);
    console.log('   Status atual:', invoice.status);

    // Atualizar status da fatura
    const paidAt = (webhookData.event === 'PAYMENT_RECEIVED' || webhookData.status === 'RECEIVED') ? new Date() : null;
    const status = webhookData.status === 'RECEIVED' ? 'paid' : 
                   webhookData.status === 'OVERDUE' ? 'overdue' : 
                   webhookData.status === 'PENDING' ? 'pending' : 
                   invoice.status || 'pending';

    console.log('🔄 Atualizando fatura:');
    console.log('   Novo status:', status);
    console.log('   Paid at:', paidAt);

    try {
      if (invoices && invoices.updateStatus) {
        const isAsync = invoices.updateStatus.constructor && invoices.updateStatus.constructor.name === 'AsyncFunction';
        if (isAsync) {
          await invoices.updateStatus(invoice.id, status, paidAt);
        } else {
          invoices.updateStatus(invoice.id, status, paidAt);
        }
      }
    } catch (err) {
      console.error('❌ Erro ao atualizar status da fatura:', err);
      if (invoices && invoices.updateStatus) {
        invoices.updateStatus(invoice.id, status, paidAt);
      }
    }

    // Se pagamento foi confirmado, ativar assinatura e atualizar payment_status do usuário
    if (status === 'paid') {
      console.log('💰 Pagamento confirmado! Ativando acesso do usuário...');
      const { users } = require('../database');
      
      // Atualizar payment_status do usuário para 'paid'
      try {
        if (users && users.updatePaymentStatus) {
          const isAsync = users.updatePaymentStatus.constructor && users.updatePaymentStatus.constructor.name === 'AsyncFunction';
          if (isAsync) {
            await users.updatePaymentStatus(invoice.user_id, 'paid');
          } else {
            users.updatePaymentStatus(invoice.user_id, 'paid');
          }
          console.log('✅ Payment status do usuário atualizado para "paid"');
        }
      } catch (err) {
        console.error('❌ Erro ao atualizar payment_status do usuário:', err);
        if (users && users.updatePaymentStatus) {
          users.updatePaymentStatus(invoice.user_id, 'paid');
        }
      }
      
      // Ativar assinatura se existir
      if (invoice.subscription_id) {
        try {
          if (subscriptions && subscriptions.updateStatus) {
            const isAsync = subscriptions.updateStatus.constructor && subscriptions.updateStatus.constructor.name === 'AsyncFunction';
            if (isAsync) {
              await subscriptions.updateStatus(invoice.subscription_id, 'active');
            } else {
              subscriptions.updateStatus(invoice.subscription_id, 'active');
            }
            console.log('✅ Assinatura ativada');
          }
        } catch (err) {
          console.error('❌ Erro ao ativar assinatura:', err);
          if (subscriptions && subscriptions.updateStatus) {
            subscriptions.updateStatus(invoice.subscription_id, 'active');
          }
        }
      }
    }

    console.log(`✅ ===== WEBHOOK PROCESSADO COM SUCESSO =====`);
    console.log(`   Event: ${webhookData.event}`);
    console.log(`   Fatura: ${invoice.id}`);
    console.log(`   Status: ${status}`);
    
    res.status(200).json({ 
      received: true, 
      processed: true,
      invoiceId: invoice.id,
      status: status
    });
  } catch (error) {
    console.error('❌ ===== ERRO AO PROCESSAR WEBHOOK =====');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    res.status(500).json({ 
      error: 'Erro ao processar webhook',
      message: error.message
    });
  }
});

// Ver fatura
router.get('/invoice/:invoiceId', requireAuth, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;

    let invoice;
    try {
      if (invoices && invoices.findById) {
        const isAsync = invoices.findById.constructor && invoices.findById.constructor.name === 'AsyncFunction';
        if (isAsync) {
          invoice = await invoices.findById(invoiceId);
        } else {
          invoice = invoices.findById(invoiceId);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar fatura:', err);
      if (invoices && invoices.findById) {
        invoice = invoices.findById(invoiceId);
      }
    }

    if (!invoice) {
      return res.redirect('/user/profile?error=fatura_nao_encontrada');
    }

    // Verificar se a fatura pertence ao usuário (ou se é admin)
    if (invoice.user_id !== userId && req.user.role !== 'admin') {
      return res.redirect('/user/profile?error=acesso_negado');
    }

    res.render('payment/invoice', {
      user: req.user,
      invoice: invoice
    });
  } catch (error) {
    console.error('Erro ao carregar fatura:', error);
    res.redirect('/user/profile?error=erro_carregar_fatura');
  }
});

module.exports = router;
