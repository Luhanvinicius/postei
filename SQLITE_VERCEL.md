# ⚠️ SQLite no Vercel - Limitações e Soluções

## ❌ Por que SQLite não funciona bem no Vercel?

O Vercel é uma plataforma **serverless**, o que significa:

1. **Stateless**: Cada requisição pode estar em um container diferente
2. **Sistema de arquivos temporário**: Arquivos são perdidos entre invocações
3. **Sem persistência**: Dados não persistem entre requisições
4. **Read-only**: O sistema de arquivos é principalmente read-only

### Problemas específicos com SQLite:

- ✅ **Funciona localmente**: SQLite precisa de um arquivo `.db` no sistema de arquivos
- ❌ **Não funciona no Vercel**: O arquivo `.db` não persiste entre invocações
- ❌ **Locks de escrita**: SQLite usa locks de arquivo que não funcionam em ambientes serverless
- ❌ **Concorrência**: Múltiplas instâncias tentando escrever no mesmo arquivo causam erros

## ✅ Soluções Recomendadas

### 1. PostgreSQL (RECOMENDADO) ⭐

**Por quê?**
- ✅ Funciona perfeitamente no Vercel
- ✅ Banco de dados remoto (não depende do sistema de arquivos)
- ✅ Suporta múltiplas conexões simultâneas
- ✅ Escalável e confiável

**Opções gratuitas:**
- [Supabase](https://supabase.com) - 500MB grátis
- [Neon](https://neon.tech) - 512MB grátis
- [Railway](https://railway.app) - Créditos grátis

**Migração:** Veja `MIGRACAO_POSTGRESQL.md`

### 2. MongoDB Atlas

**Por quê?**
- ✅ NoSQL, fácil de usar
- ✅ Funciona no Vercel
- ✅ 512MB grátis

**URL:** https://www.mongodb.com/cloud/atlas

### 3. Turso (SQLite Distribuído)

**Por quê?**
- ✅ Mantém a sintaxe SQLite
- ✅ Funciona no Vercel
- ⚠️ Plano pago (mas tem trial)

**URL:** https://turso.tech

## 🔄 Alternativa Temporária: Usar SQLite apenas localmente

Se você quiser manter SQLite para desenvolvimento local:

1. **Desenvolvimento**: Use SQLite localmente
2. **Produção (Vercel)**: Use PostgreSQL

Você pode detectar o ambiente:

```javascript
const isVercel = process.env.VERCEL === '1';
const db = isVercel ? require('./database-pg') : require('./database-sqlite');
```

## 📊 Comparação Rápida

| Recurso | SQLite | PostgreSQL | MongoDB |
|---------|--------|------------|---------|
| Funciona no Vercel | ❌ | ✅ | ✅ |
| Grátis | ✅ | ✅ | ✅ |
| Fácil setup | ✅ | ⚠️ | ✅ |
| Escalável | ❌ | ✅ | ✅ |
| Suporte SQL | ✅ | ✅ | ❌ |

## 🚀 Recomendação Final

**Use PostgreSQL com Supabase ou Neon:**
- Setup rápido (5 minutos)
- Grátis até 500MB
- Funciona perfeitamente no Vercel
- Migração simples do SQLite

Veja o guia completo em `MIGRACAO_POSTGRESQL.md`

