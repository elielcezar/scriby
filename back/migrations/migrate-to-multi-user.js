/**
 * Script de migração de dados para sistema multi-usuário
 * 
 * Este script deve ser executado APÓS a migration do Prisma que adiciona:
 * - userId aos modelos Post, Pauta e Fonte
 * - role ao modelo User
 * - Mudança de ID do User de Int para String (UUID)
 * 
 * IMPORTANTE: Execute este script apenas uma vez após a migration do Prisma
 */

import { PrismaClient } from '@prisma/client';
import prisma from '../config/prisma.js';

const ADMIN_EMAIL = 'elielcezar@gmail.com';

async function migrate() {
  try {
    console.log('🚀 Iniciando migração para sistema multi-usuário...\n');

    // 1. Buscar ou criar usuário admin
    console.log('1️⃣ Buscando usuário admin...');
    let adminUser = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL }
    });

    if (!adminUser) {
      console.log('⚠️  Usuário admin não encontrado!');
      console.log('   Por favor, certifique-se de que o usuário com email:', ADMIN_EMAIL);
      console.log('   existe no banco de dados antes de executar este script.');
      process.exit(1);
    }

    console.log(`✅ Usuário admin encontrado: ${adminUser.email} (ID: ${adminUser.id})`);

    // 2. Atualizar role do admin para ADMIN
    console.log('\n2️⃣ Atualizando role do admin...');
    adminUser = await prisma.user.update({
      where: { id: adminUser.id },
      data: { role: 'ADMIN' }
    });
    console.log(`✅ Role atualizado para: ${adminUser.role}`);

    // 3. Atribuir todos os posts ao admin
    console.log('\n3️⃣ Atribuindo posts ao admin...');
    const postsCount = await prisma.post.count({
      where: { userId: null }
    });

    if (postsCount > 0) {
      const result = await prisma.post.updateMany({
        where: { userId: null },
        data: { userId: adminUser.id }
      });
      console.log(`✅ ${result.count} posts atribuídos ao admin`);
    } else {
      console.log('ℹ️  Nenhum post sem usuário encontrado');
    }

    // 4. Atribuir todas as pautas ao admin
    console.log('\n4️⃣ Atribuindo pautas ao admin...');
    const pautasCount = await prisma.pauta.count({
      where: { userId: null }
    });

    if (pautasCount > 0) {
      const result = await prisma.pauta.updateMany({
        where: { userId: null },
        data: { userId: adminUser.id }
      });
      console.log(`✅ ${result.count} pautas atribuídas ao admin`);
    } else {
      console.log('ℹ️  Nenhuma pauta sem usuário encontrada');
    }

    // 5. Atribuir todas as fontes ao admin
    console.log('\n5️⃣ Atribuindo fontes ao admin...');
    const fontesCount = await prisma.fonte.count({
      where: { userId: null }
    });

    if (fontesCount > 0) {
      const result = await prisma.fonte.updateMany({
        where: { userId: null },
        data: { userId: adminUser.id }
      });
      console.log(`✅ ${result.count} fontes atribuídas ao admin`);
    } else {
      console.log('ℹ️  Nenhuma fonte sem usuário encontrada');
    }

    console.log('\n✅ Migração concluída com sucesso!');
    console.log('\n📊 Resumo:');
    console.log(`   - Admin: ${adminUser.email} (${adminUser.role})`);
    console.log(`   - Posts: ${await prisma.post.count({ where: { userId: adminUser.id } })}`);
    console.log(`   - Pautas: ${await prisma.pauta.count({ where: { userId: adminUser.id } })}`);
    console.log(`   - Fontes: ${await prisma.fonte.count({ where: { userId: adminUser.id } })}`);

  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar migração
migrate()
  .then(() => {
    console.log('\n✨ Processo finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });

