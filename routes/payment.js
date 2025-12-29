const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { plans, subscriptions, invoices } = require('../database');
const asaasService = require('../services/asaas-service');

// Página de seleção de plano (para usuários com pagamento pendente)
router.get('/select-plan', requireAuth, (req, res) => {
  res.redirect('/user/plans');
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

    // Log para debug: verificar se os dados do cliente estão na fatura
    if (invoiceData) {
      console.log('📋 Fatura carregada:', {
        id: invoiceData.id,
        status: invoiceData.status,
        hasCustomerName: !!invoiceData.customer_name,
        hasCustomerCpf: !!invoiceData.customer_cpf,
        hasCustomerPhone: !!invoiceData.customer_phone
      });
      
      // Se a fatura foi paga, atualizar payment_status do usuário na sessão e redirecionar
      if (invoiceData.status === 'paid' && req.session && req.session.user) {
        const { users } = require('../database');
        let userData;
        try {
          if (users && users.findById) {
            const isAsync = users.findById.constructor && users.findById.constructor.name === 'AsyncFunction';
            if (isAsync) {
              userData = await users.findById(userId);
            } else {
              userData = users.findById(userId);
            }
          }
        } catch (err) {
          console.error('Erro ao buscar dados do usuário:', err);
        }
        
        if (userData && userData.payment_status === 'paid') {
          req.session.user.payment_status = 'paid';
          req.user.payment_status = 'paid';
          // Salvar sessão antes de redirecionar
          await new Promise((resolve, reject) => {
            req.session.save((err) => {
              if (err) {
                console.error('❌ Erro ao salvar sessão:', err);
                reject(err);
              } else {
                console.log('✅ Sessão atualizada: payment_status = paid');
                resolve();
              }
            });
          });
          
          // Redirecionar para o dashboard quando o pagamento foi confirmado
          console.log('✅ Pagamento confirmado! Redirecionando para o dashboard...');
          return res.redirect('/user/dashboard?payment=confirmed');
        }
      }
    }

    res.render('payment/pending', {
      user: req.user,
      invoice: invoiceData
    });
  } catch (error) {
    console.error('Erro ao carregar página de pagamento pendente:', error);
    res.redirect('/user/plans');
  }
});

// Página de checkout
router.get('/checkout/:planSlug', async (req, res) => {
  try {
    console.log('🔍 Acessando checkout:', req.params.planSlug);
    console.log('👤 Usuário:', req.user ? req.user.username : 'não autenticado');
    console.log('🔑 Token:', req.token ? req.token.substring(0, 10) + '...' : 'ausente');
    
    // Se não estiver autenticado, redirecionar para cadastro com o plano selecionado
    if (!req.user) {
      console.log('🔍 Usuário não autenticado - redirecionando para cadastro com plano:', req.params.planSlug);
      return res.redirect(`/auth/register?plan=${req.params.planSlug}`);
    }
    
    console.log('👤 Usuário autenticado:', req.user.username, 'Payment Status:', req.user.payment_status);
    
    const { planSlug } = req.params;
    const userId = req.user.id;

    // Buscar plano
    let plan = null;
    try {
      if (!plans || !plans.findBySlug) {
        console.error('❌ plans ou plans.findBySlug não encontrado');
        return res.redirect('/user/plans?error=erro_buscar_plano');
      }
      
      plan = await Promise.resolve(plans.findBySlug(planSlug));
      console.log('📦 Plano buscado:', plan ? plan.name : 'não encontrado');
    } catch (err) {
      console.error('❌ Erro ao buscar plano:', err);
      console.error('Stack:', err.stack);
      return res.redirect('/user/plans?error=erro_buscar_plano');
    }

    if (!plan) {
      console.error('❌ Plano não encontrado:', planSlug);
      return res.redirect('/user/plans?error=plano_nao_encontrado');
    }

    console.log('✅ Plano encontrado:', plan.name);
    console.log('📄 Renderizando checkout...');
    
    res.render('payment/checkout', {
      user: req.user,
      plan: plan,
      token: req.token || req.query.token
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
      state,
      paymentMethod = 'PIX'
    } = req.body;

    // Validações básicas
    if (!name || !email || !cpfCnpj || !phone) {
      return res.json({ success: false, error: 'Preencha todos os campos obrigatórios' });
    }

    // Buscar plano
    let plan = null;
    try {
      if (!plans || !plans.findBySlug) {
        return res.json({ success: false, error: 'Erro ao acessar banco de dados de planos' });
      }
      
      plan = await Promise.resolve(plans.findBySlug(planSlug));
    } catch (err) {
      console.error('❌ Erro ao buscar plano:', err);
      console.error('Stack:', err.stack);
      return res.json({ success: false, error: 'Erro ao buscar plano: ' + err.message });
    }

    if (!plan) {
      return res.json({ success: false, error: 'Plano não encontrado' });
    }

    // Calcular data de vencimento (3 dias a partir de hoje)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    let asaasPaymentId = null;
    let pixQrCode = null;
    let pixCopyPaste = null;
    let billingType = 'PIX';

    // Mapear método de pagamento para formato do Asaas
    if (paymentMethod === 'BOLETO') {
      billingType = 'BOLETO';
    } else if (paymentMethod === 'CREDIT_CARD') {
      billingType = 'CREDIT_CARD';
    } else {
      billingType = 'PIX';
    }

    // Verificar se Asaas está configurado
    if (asaasService.isConfigured()) {
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

    // Criar pagamento no Asaas
    const paymentResult = await asaasService.createPayment({
      customerId: asaasCustomerId,
        billingType: billingType,
      value: plan.price,
      dueDate: dueDateStr,
      description: `Assinatura ${plan.name} - YouTube Automation`,
      externalReference: `user_${userId}_plan_${plan.id}_${Date.now()}`
    });

    if (!paymentResult.success) {
      return res.json({ success: false, error: 'Erro ao criar pagamento: ' + JSON.stringify(paymentResult.error) });
    }

    const asaasPayment = paymentResult.data;
      asaasPaymentId = asaasPayment.id;

      // Buscar QR Code PIX apenas se o método for PIX
      if (billingType === 'PIX') {
    const pixResult = await asaasService.getPixQrCode(asaasPayment.id);
    if (pixResult.success) {
      pixQrCode = pixResult.data.encodedImage;
      pixCopyPaste = pixResult.data.payload;
        }
      } else if (billingType === 'BOLETO') {
        // Para boleto, pegar o código de barras
        pixCopyPaste = asaasPayment.barCode || asaasPayment.barcode || null;
      } else if (billingType === 'CREDIT_CARD') {
        // Para cartão, pode precisar de link de pagamento ou token
        pixCopyPaste = asaasPayment.invoiceUrl || asaasPayment.checkoutUrl || null;
      }
    } else {
      // Modo desenvolvimento: criar fatura local sem Asaas
      console.log('⚠️  Asaas não configurado - criando fatura local para desenvolvimento');
      asaasPaymentId = `dev_${Date.now()}_${userId}`;
      pixQrCode = null;
      pixCopyPaste = 'MODO DESENVOLVIMENTO: Configure ASAAS_API_KEY no arquivo .env para usar pagamentos reais';
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
            asaasPaymentId,
            invoiceNumber,
            dueDateStr,
            pixQrCode,
            pixCopyPaste,
            billingType,
            name,
            cpfCnpj.replace(/\D/g, ''),
            phone.replace(/\D/g, '')
          );
        } else {
          invoiceId = invoices.create(
            userId,
            plan.id,
            subscriptionId,
            plan.price,
            asaasPaymentId,
            invoiceNumber,
            dueDateStr,
            pixQrCode,
            pixCopyPaste,
            billingType,
            name,
            cpfCnpj.replace(/\D/g, ''),
            phone.replace(/\D/g, '')
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
          asaasPaymentId,
          invoiceNumber,
          dueDateStr,
          pixQrCode,
          pixCopyPaste,
          billingType,
          name,
          cpfCnpj.replace(/\D/g, ''),
          phone.replace(/\D/g, '')
        );
      }
    }

    res.json({
      success: true,
      invoiceId: invoiceId,
      pixQrCode: pixQrCode,
      pixCopyPaste: pixCopyPaste,
      dueDate: dueDateStr,
      paymentMethod: paymentMethod,
      billingType: billingType,
      invoiceUrl: asaasPaymentId ? (asaasService.isConfigured() ? `https://sandbox.asaas.com/c/${asaasPaymentId}` : null) : null,
      message: 'Fatura gerada com sucesso! Redirecionando...'
    });
  } catch (error) {
    console.error('Erro ao processar checkout:', error);
    res.json({ success: false, error: 'Erro ao processar pagamento: ' + error.message });
  }
});

// Regenerar pagamento de uma fatura existente (quando Asaas não estava configurado antes)
router.post('/regenerate/:invoiceId', requireAuth, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;
    const { name, cpfCnpj, phone } = req.body; // Dados obrigatórios do Asaas
    
    // Verificar se Asaas está configurado agora
    if (!asaasService.isConfigured()) {
      return res.json({ 
        success: false, 
        error: 'Asaas ainda não está configurado. Configure ASAAS_API_KEY no arquivo .env' 
      });
    }
    
    // Buscar fatura
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
      return res.json({ success: false, error: 'Fatura não encontrada' });
    }
    
    // Verificar se a fatura pertence ao usuário
    if (invoice.user_id !== userId && req.user.role !== 'admin') {
      return res.json({ success: false, error: 'Acesso negado' });
    }
    
    // Verificar se a fatura já tem pagamento do Asaas
    if (invoice.asaas_invoice_id && !invoice.asaas_invoice_id.startsWith('dev_')) {
      return res.json({ 
        success: false, 
        error: 'Esta fatura já tem um pagamento gerado no Asaas' 
      });
    }
    
    // Buscar dados do usuário
    const { users } = require('../database');
    let userData;
    try {
      if (users && users.findById) {
        const isAsync = users.findById.constructor && users.findById.constructor.name === 'AsyncFunction';
        if (isAsync) {
          userData = await users.findById(userId);
        } else {
          userData = users.findById(userId);
        }
      }
    } catch (err) {
      userData = users.findById(userId);
    }
    
    // Buscar plano
    const { plans } = require('../database');
    let plan = null;
    try {
      if (!plans || !plans.findById) {
        return res.json({ success: false, error: 'Erro ao acessar banco de dados de planos' });
      }
      
      plan = await Promise.resolve(plans.findById(invoice.plan_id));
    } catch (err) {
      console.error('❌ Erro ao buscar plano:', err);
      return res.json({ success: false, error: 'Erro ao buscar plano: ' + err.message });
    }
    
    if (!plan) {
      return res.json({ success: false, error: 'Plano não encontrado' });
    }
    
    // Priorizar dados do body (se fornecidos), senão usar dados salvos na fatura
    // Isso permite atualizar os dados se foram preenchidos no modal
    let customerName = name || invoice.customer_name;
    let customerCpf = cpfCnpj || invoice.customer_cpf;
    let customerPhone = phone || invoice.customer_phone;
    
    // Se não tiver dados nem na fatura nem no body, retornar erro
    if (!customerName || !customerCpf) {
      return res.json({ 
        success: false, 
        error: 'Nome e CPF/CNPJ são obrigatórios. Por favor, preencha os dados no formulário.' 
      });
    }
    
    // Preparar dados do cliente (campos obrigatórios: name e cpfCnpj)
    const customerData = {
      name: customerName,
      cpfCnpj: customerCpf.replace(/\D/g, ''), // Remove formatação do CPF/CNPJ
      email: userData.email || null,
      phone: customerPhone ? customerPhone.replace(/\D/g, '') : null,
      postalCode: null,
      address: null,
      addressNumber: null,
      complement: null,
      province: null,
      city: null,
      state: null
    };
    
    // Criar cliente no Asaas
    const customerResult = await asaasService.createCustomer(customerData);
    
    if (!customerResult.success) {
      return res.json({ 
        success: false, 
        error: 'Erro ao criar cliente no Asaas: ' + JSON.stringify(customerResult.error) 
      });
    }
    
    const asaasCustomerId = customerResult.data.id;
    
    // Calcular data de vencimento (usar a data original da fatura ou 3 dias a partir de hoje)
    let dueDateStr = invoice.due_date;
    if (!dueDateStr || new Date(dueDateStr) < new Date()) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      dueDateStr = dueDate.toISOString().split('T')[0];
    }
    
    // Mapear método de pagamento para formato do Asaas
    let billingType = 'PIX'; // Padrão
    const paymentMethod = (invoice.payment_method || 'PIX').toUpperCase();
    if (paymentMethod === 'BOLETO') {
      billingType = 'BOLETO';
    } else if (paymentMethod === 'CREDIT_CARD' || paymentMethod === 'CARTAO' || paymentMethod === 'CARD') {
      billingType = 'CREDIT_CARD';
    } else {
      billingType = 'PIX';
    }
    
    // Criar pagamento no Asaas
    const paymentResult = await asaasService.createPayment({
      customerId: asaasCustomerId,
      billingType: billingType,
      value: invoice.amount,
      dueDate: dueDateStr,
      description: `Assinatura ${plan.name} - YouTube Automation`,
      externalReference: `user_${userId}_plan_${plan.id}_${Date.now()}`
    });
    
    if (!paymentResult.success) {
      return res.json({ 
        success: false, 
        error: 'Erro ao criar pagamento no Asaas: ' + JSON.stringify(paymentResult.error) 
      });
    }
    
    const asaasPayment = paymentResult.data;
    const asaasPaymentId = asaasPayment.id;
    
    // Buscar QR Code PIX se o método for PIX
    let pixQrCode = invoice.pix_qr_code;
    let pixCopyPaste = invoice.pix_copy_paste;
    
    if ((invoice.payment_method || 'PIX') === 'PIX') {
      const pixResult = await asaasService.getPixQrCode(asaasPayment.id);
      
      if (pixResult.success) {
        // O Asaas retorna: { encodedImage: "base64...", payload: "000201..." }
        // Verificar todas as possibilidades de campos
        let encodedImage = pixResult.data.encodedImage || 
                          pixResult.data.qrCode || 
                          pixResult.data.image ||
                          pixResult.data.base64Image ||
                          pixResult.data.qrCodeImage ||
                          pixResult.data.encoded_image;
        
        // O payload é a chave PIX copiar e colar
        pixCopyPaste = pixResult.data.payload || 
                      pixResult.data.copyPaste || 
                      pixResult.data.pixCopyPaste ||
                      pixResult.data.pixKey ||
                      pixResult.data.qrCode;
        
        // Processar o QR code se existir
        if (encodedImage) {
          // Remover espaços e quebras de linha
          encodedImage = encodedImage.trim().replace(/\s/g, '');
          
          // Se não começar com data:, adicionar o prefixo
          if (!encodedImage.startsWith('data:')) {
            pixQrCode = `data:image/png;base64,${encodedImage}`;
          } else {
            pixQrCode = encodedImage;
          }
          
          console.log('✅ QR Code PIX obtido e formatado:', {
            hasQrCode: !!pixQrCode,
            qrCodeLength: pixQrCode.length,
            qrCodeStartsWith: pixQrCode.substring(0, 30),
            hasPayload: !!pixCopyPaste,
            payloadLength: pixCopyPaste ? pixCopyPaste.length : 0
          });
        } else {
          console.warn('⚠️ QR Code (encodedImage) não encontrado na resposta do Asaas.');
          console.warn('📋 Estrutura completa da resposta:', JSON.stringify(pixResult.data, null, 2));
          console.warn('📋 Chaves disponíveis:', Object.keys(pixResult.data || {}));
          
          // Se não tiver encodedImage mas tiver payload, tentar gerar QR code a partir do payload
          if (pixCopyPaste && !pixQrCode) {
            console.log('🔄 Tentando gerar QR Code a partir da chave PIX...');
            try {
              const QRCode = require('qrcode');
              const qrCodeDataUrl = await QRCode.toDataURL(pixCopyPaste, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                margin: 1,
                width: 300
              });
              pixQrCode = qrCodeDataUrl;
              console.log('✅ QR Code gerado a partir da chave PIX com sucesso!');
            } catch (qrError) {
              if (qrError.code === 'MODULE_NOT_FOUND') {
                console.warn('⚠️ Biblioteca qrcode não instalada. Execute: npm install qrcode');
                console.warn('⚠️ Continuando sem QR Code visual, mas a chave PIX está disponível para copiar e colar.');
              } else {
                console.error('❌ Erro ao gerar QR Code a partir da chave PIX:', qrError.message);
              }
            }
          }
          
          // Se não tiver encodedImage mas tiver payload, tentar gerar QR code a partir do payload
          if (pixCopyPaste && !pixQrCode) {
            console.log('🔄 Tentando gerar QR Code a partir da chave PIX...');
            try {
              const QRCode = require('qrcode');
              const qrCodeDataUrl = await QRCode.toDataURL(pixCopyPaste, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                margin: 1,
                width: 300
              });
              pixQrCode = qrCodeDataUrl;
              console.log('✅ QR Code gerado a partir da chave PIX com sucesso!');
            } catch (qrError) {
              if (qrError.code === 'MODULE_NOT_FOUND') {
                console.warn('⚠️ Biblioteca qrcode não instalada. Execute: npm install qrcode');
              } else {
                console.error('❌ Erro ao gerar QR Code a partir da chave PIX:', qrError.message);
              }
            }
          }
        }
      } else {
        console.error('❌ Erro ao buscar QR Code PIX:', pixResult.error);
      }
    } else if ((invoice.payment_method || 'PIX') === 'BOLETO') {
      pixCopyPaste = asaasPayment.barCode || asaasPayment.barcode || null;
    } else if ((invoice.payment_method || 'PIX') === 'CREDIT_CARD') {
      pixCopyPaste = asaasPayment.invoiceUrl || asaasPayment.checkoutUrl || null;
    }
    
    // Atualizar fatura com dados do Asaas E dados do cliente (se foram fornecidos)
    // Usar SQL direto para atualizar campos específicos
    const { db } = require('../database');
    try {
      // Verificar se é SQLite ou PostgreSQL
      if (db.prepare) {
        // SQLite
        // Sempre salvar os dados do cliente (seja do body ou da fatura) para garantir que estão atualizados
        const updateResult = db.prepare(`
          UPDATE invoices 
          SET asaas_invoice_id = ?, 
              pix_qr_code = ?, 
              pix_copy_paste = ?,
              customer_name = ?,
              customer_cpf = ?,
              customer_phone = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(asaasPaymentId, pixQrCode, pixCopyPaste, customerName, customerCpf.replace(/\D/g, ''), customerPhone ? customerPhone.replace(/\D/g, '') : null, invoiceId);
        
        console.log('💾 Fatura atualizada no SQLite:', {
          invoiceId,
          changes: updateResult.changes,
          hasQrCode: !!pixQrCode,
          qrCodeLength: pixQrCode ? pixQrCode.length : 0,
          hasPayload: !!pixCopyPaste
        });
      } else {
        // PostgreSQL - usar query direta
        // Sempre salvar os dados do cliente (seja do body ou da fatura) para garantir que estão atualizados
        const updateResult = await db.query(`
          UPDATE invoices 
          SET asaas_invoice_id = $1, 
              pix_qr_code = $2, 
              pix_copy_paste = $3,
              customer_name = $4,
              customer_cpf = $5,
              customer_phone = $6,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $7
        `, [asaasPaymentId, pixQrCode, pixCopyPaste, customerName, customerCpf.replace(/\D/g, ''), customerPhone ? customerPhone.replace(/\D/g, '') : null, invoiceId]);
        
        console.log('💾 Fatura atualizada no PostgreSQL:', {
          invoiceId,
          rowCount: updateResult.rowCount,
          hasQrCode: !!pixQrCode,
          qrCodeLength: pixQrCode ? pixQrCode.length : 0,
          hasPayload: !!pixCopyPaste
        });
      }
      
      console.log(`✅ Fatura ${invoiceId} atualizada com dados do Asaas e dados do cliente salvos`);
    } catch (err) {
      console.error('Erro ao atualizar fatura:', err);
      return res.json({ 
        success: false, 
        error: 'Erro ao atualizar fatura: ' + err.message 
      });
    }
    
    res.json({
      success: true,
      message: 'Pagamento regenerado com sucesso!',
      pixQrCode: pixQrCode,
      pixCopyPaste: pixCopyPaste,
      invoiceId: invoiceId
    });
  } catch (error) {
    console.error('Erro ao regenerar pagamento:', error);
    res.json({ success: false, error: 'Erro ao regenerar pagamento: ' + error.message });
  }
});

// Verificar status do pagamento no Asaas manualmente (GET e POST)
const checkPaymentStatusHandler = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;
    
    // Buscar fatura
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
      return res.json({ success: false, error: 'Fatura não encontrada' });
    }
    
    // Verificar se a fatura pertence ao usuário
    if (invoice.user_id !== userId && req.user.role !== 'admin') {
      return res.json({ success: false, error: 'Acesso negado' });
    }
    
    // Se não tiver asaas_invoice_id, não pode verificar
    if (!invoice.asaas_invoice_id || invoice.asaas_invoice_id.startsWith('dev_')) {
      return res.json({ 
        success: false, 
        error: 'Esta fatura não tem um pagamento no Asaas para verificar' 
      });
    }
    
    // Buscar status do pagamento no Asaas
    const paymentResult = await asaasService.getPayment(invoice.asaas_invoice_id);
    
    if (!paymentResult.success) {
      return res.json({ 
        success: false, 
        error: 'Erro ao buscar status no Asaas: ' + JSON.stringify(paymentResult.error) 
      });
    }
    
    const asaasPayment = paymentResult.data;
    const asaasStatus = asaasPayment.status || 'PENDING';
    
    // Mapear status do Asaas para nosso formato
    let newStatus = 'pending';
    if (asaasStatus === 'RECEIVED' || asaasStatus === 'CONFIRMED') {
      newStatus = 'paid';
    } else if (asaasStatus === 'OVERDUE') {
      newStatus = 'overdue';
    }
    
    // Atualizar status da fatura se mudou
    if (invoice.status !== newStatus) {
      // Converter Date para string ISO para SQLite (SQLite não aceita objetos Date)
      const paidAt = newStatus === 'paid' ? new Date().toISOString() : null;
      
      try {
        if (invoices && invoices.updateStatus) {
          const isAsync = invoices.updateStatus.constructor && invoices.updateStatus.constructor.name === 'AsyncFunction';
          if (isAsync) {
            await invoices.updateStatus(invoice.id, newStatus, paidAt);
          } else {
            invoices.updateStatus(invoice.id, newStatus, paidAt);
          }
        }
        
        // Se pagamento foi confirmado, ativar acesso do usuário
        if (newStatus === 'paid') {
          const { users } = require('../database');
          if (users && users.updatePaymentStatus) {
            const isAsync = users.updatePaymentStatus.constructor && users.updatePaymentStatus.constructor.name === 'AsyncFunction';
            if (isAsync) {
              await users.updatePaymentStatus(invoice.user_id, 'paid');
            } else {
              users.updatePaymentStatus(invoice.user_id, 'paid');
            }
          }
          
          // Atualizar sessão do usuário se for o mesmo usuário da requisição
          if (req.session && req.session.user && req.session.user.id === invoice.user_id) {
            req.session.user.payment_status = 'paid';
            // Salvar sessão usando Promise wrapper (express-session usa callbacks)
            await new Promise((resolve, reject) => {
              req.session.save((err) => {
                if (err) {
                  console.error('❌ Erro ao salvar sessão:', err);
                  reject(err);
                } else {
                  console.log('✅ Sessão do usuário atualizada para payment_status: paid');
                  resolve();
                }
              });
            });
          }
        }
        
        return res.json({ 
          success: true, 
          message: 'Status atualizado!',
          oldStatus: invoice.status,
          newStatus: newStatus,
          asaasStatus: asaasStatus
        });
      } catch (err) {
        console.error('Erro ao atualizar status:', err);
        return res.json({ 
          success: false, 
          error: 'Erro ao atualizar status: ' + err.message 
        });
      }
    } else {
      return res.json({ 
        success: true, 
        message: 'Status já está atualizado',
        status: invoice.status,
        asaasStatus: asaasStatus
      });
    }
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    res.json({ success: false, error: 'Erro ao verificar pagamento: ' + error.message });
  }
};

// Registrar a mesma função para GET e POST
router.get('/check/:invoiceId', requireAuth, checkPaymentStatusHandler);
router.post('/check/:invoiceId', requireAuth, checkPaymentStatusHandler);

// Validar fatura manualmente (para desenvolvimento/teste)
router.post('/validate/:invoiceId', requireAuth, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;
    
    // Buscar fatura
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
      return res.json({ success: false, error: 'Fatura não encontrada' });
    }
    
    // Verificar se a fatura pertence ao usuário (ou se é admin)
    if (invoice.user_id !== userId && req.user.role !== 'admin') {
      return res.json({ success: false, error: 'Acesso negado' });
    }
    
    // Atualizar status da fatura para 'paid'
    // Converter Date para string ISO para SQLite (SQLite não aceita objetos Date)
    const paidAt = new Date().toISOString();
    try {
      if (invoices && invoices.updateStatus) {
        const isAsync = invoices.updateStatus.constructor && invoices.updateStatus.constructor.name === 'AsyncFunction';
        if (isAsync) {
          await invoices.updateStatus(invoiceId, 'paid', paidAt);
        } else {
          invoices.updateStatus(invoiceId, 'paid', paidAt);
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar fatura:', err);
      if (invoices && invoices.updateStatus) {
        invoices.updateStatus(invoiceId, 'paid', paidAt);
      }
    }
    
    // Atualizar payment_status do usuário
    const { users } = require('../database');
    try {
      if (users && users.updatePaymentStatus) {
        const isAsync = users.updatePaymentStatus.constructor && users.updatePaymentStatus.constructor.name === 'AsyncFunction';
        if (isAsync) {
          await users.updatePaymentStatus(userId, 'paid');
        } else {
          users.updatePaymentStatus(userId, 'paid');
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar payment_status:', err);
      if (users && users.updatePaymentStatus) {
        users.updatePaymentStatus(userId, 'paid');
      }
    }
    
    // Atualizar sessão do usuário
    if (req.session && req.session.user) {
      req.session.user.payment_status = 'paid';
      req.session.save();
    }
    
    console.log(`✅ Fatura ${invoiceId} validada manualmente para usuário ${userId}`);
    
    res.json({
      success: true,
      message: 'Fatura validada com sucesso! Redirecionando...'
    });
  } catch (error) {
    console.error('Erro ao validar fatura:', error);
    res.json({ success: false, error: 'Erro ao validar fatura: ' + error.message });
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
    // Converter Date para string ISO para SQLite (SQLite não aceita objetos Date)
    const paidAt = (webhookData.event === 'PAYMENT_RECEIVED' || webhookData.status === 'RECEIVED') ? new Date().toISOString() : null;
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
