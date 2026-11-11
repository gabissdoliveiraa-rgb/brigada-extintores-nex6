# 🎓 Guia Completo para Apresentação e Banca de TCC

**Projeto**: Sistema Integrado de Gestão de Extintores, Inspeções e Brigada de Incêndio (SENAI)  
**Normas de Referência**: NR-23 (Proteção Contra Incêndios), NBR 12962 (Inspeção, manutenção e recarga em extintores de incêndio), IT-17 / NBR 14276 (Brigada de Incêndio), Documento SENAI RH 049 (Anexo 2 - Equipamentos e Sistemas de Combate a Incêndio).

---

## 1. Visão Geral e Problema Solucionado

### ❓ Qual era o problema?
Tradicionalmente, a vistoria de extintores e a gestão da brigada de incêndio em plantas industriais e instituições de ensino são feitas em **planilhas de papel ou cadernos de campo**. Isso causava:
- Risco de extravio e rasuras em fichas de inspeção.
- Falta de controle em tempo real de recargas vencidas ou testes hidrostáticos atrasados (que ocorrem a cada 5 anos segundo a NBR 12962).
- Dificuldade para o brigadista localizar rapidamente o extintor correto no momento de uma emergência.
- Brigadistas com certificados de treinamento vencidos sem alerta preventivo para a CIPA e Segurança do Trabalho.

### 💡 A Solução Desenvolvida
Uma aplicação web progressiva (PWA / Web App) moderna, responsiva e segura que digitaliza 100% da operação:
1. **Mapeamento Oficial de 123 Extintores**: Baseado estritamente no documento institucional **SENAI RH 049**, divididos pelos 5 pavimentos e áreas técnicas (Térreo, 1º Pavimento, 2º Pavimento, 3º Pavimento e Subsolo).
2. **Tecnologia de Identificação por QR Code**: Cada extintor físico possui uma etiqueta adesiva com QR Code padronizado (`SENAI-EXT-XXXXXX`). Ao apontar a câmera do celular, o sistema abre instantaneamente a ficha técnica do equipamento (tipo de carga, agente extintor, capacidade, localização exata e botão para registrar vistoria).
3. **Gestão da Brigada de Incêndio**: Controle de 12 brigadistas (líderes e operacionais), com acompanhamento rigoroso do status de capacitação (treinamento em dia vs. vencido).
4. **Segurança e Perfis de Acesso (RBAC)**:
   - **Administrador** (Melissa Jesus): acesso total a cadastros, exclusões, alterações no banco de dados e restauração.
   - **Funcionário** (João Souza): acesso focado em inspeção de campo, consulta de mapas e leitura de QR Code.
5. **Autonomia e Persistência**: Banco de dados estruturado no navegador (`localStorage`) com recurso de autocura, exportação e importação de backups completos em formato JSON.

---

## 2. Arquitetura e Stack Tecnológico

| Camada | Tecnologia Utilizada | Justificativa Técnica |
|---|---|---|
| **Linguagem** | TypeScript (strict mode) | Tipagem estática forte, prevenção de erros em tempo de compilação e previsibilidade de dados. |
| **Frontend Framework** | React 19 (Functional Components + Hooks) | Renderização modular, reatividade em tempo real e componentização limpa. |
| **Estilização** | Tailwind CSS v4 | Estilização utilitária atômica, design responsivo (mobile, tablet e desktop) e visual limpo padrão SENAI (vermelho corporativo, cinzas neutros e alertas semafóricos). |
| **Ícones** | Lucide React | Ícones SVG vetoriais leves e consistentes. |
| **Leitura de QR Code** | jsQR + WebRTC (`navigator.mediaDevices.getUserMedia`) | Acesso à câmera traseira do smartphone diretamente pelo navegador sem precisar instalar aplicativos de terceiros. |
| **Geração de QR Code** | qrcode (canvas/dataUrl) | Geração vetorial em alta resolução de etiquetas adesivas prontas para impressão e download em PNG. |
| **Geração de Relatórios** | jsPDF | Emissão de relatórios técnicos de conformidade em PDF para auditorias do Corpo de Bombeiros. |
| **Persistência de Dados** | Web Storage API (JSON estruturado com versionamento e autocura) | Funciona 100% offline, sem custos de servidor de banco de dados, com exportação e importação de backups integrais. |
| **Build & Deploy** | Vite + GitHub Actions + GitHub Pages | Compilação ultrarrápida e hospedagem estática gratuita com HTTPS seguro (essencial para a câmera funcionar). |

---

## 3. Principais Módulos do Sistema

1. **Dashboard (Visão Geral)**:
   - 4 Cartões de Indicadores Chave (KPIs): Total da Brigada, Extintores Cadastrados, Vistorias em Dia e Extintores Vencidos.
   - Tabela de Próximas Inspeções com prioridade visual.
   - Feed de Avisos Operacionais automáticos.

2. **Extintores & Mapa Rápido**:
   - Visualização por pavimento com guias dinâmicas: Todos (123), Térreo (31), 1º Pavimento (25), 2º Pavimento (19), 3º Pavimento (20) e Subsolo (28).
   - Busca rápida por código e filtro por tipo de extintor (Água Pressurizada AP 10L, Pó Químico Seco PQS ABC 4kg/6kg e Gás Carbônico CO2 6kg).
   - Espaço de mapa visual demarcado por pontilhados com pinos dos extintores posicionados.
   - Botão para abrir o leitor de QR Code pela câmera.

3. **Inspeções Periódicas (Vistorias)**:
   - Registro de conformidade física: estado do lacre de segurança, pressão do manômetro, desobstrução do acesso, conferência de peso e integridade da mangueira/difusor.
   - Histórico cronológico auditável.

4. **Equipe da Brigada de Incêndio**:
   - Cadastro detalhado com foto/avatar, cargo operacional, função na emergência, pavimento de atuação e data limite do treinamento.
   - Alerta visual imediato caso o certificado de reciclagem anual esteja vencido.

5. **Banco de Dados & E-mails**:
   - Gestão centralizada dos usuários autorizados (Admin e Funcionário).
   - Exportação completa em JSON para cópia de segurança.
   - Importação de backups e opção de restauração dos dados padrão do SENAI.

---

## 4. Perguntas Prováveis da Banca e Como Responder

### Pergunta 1: *"Por que vocês escolheram uma aplicação web (PWA) em vez de um aplicativo nativo para Android/iOS?"*
> **Resposta ideal**:  
> *"Optamos por uma aplicação web moderna porque ela não requer aprovação em lojas de aplicativos nem instalação pesada nos celulares da equipe. Qualquer funcionário ou brigadista pode abrir o sistema pelo navegador do celular através de um link com HTTPS. Além disso, utilizamos APIs nativas modernas da web, como a `navigator.mediaDevices.getUserMedia` para acessar a câmera e ler QR Codes com a mesma performance e fluidez de um app nativo."*

### Pergunta 2: *"Como o sistema garante que um extintor cadastrado não seja perdido se o usuário limpar o cache do navegador?"*
> **Resposta ideal**:  
> *"Desenvolvemos o sistema com dois mecanismos de resiliência:  
> 1) O mecanismo de **autocura**, que verifica na inicialização se os 123 extintores oficiais do documento RH 049 e os 12 membros da brigada estão carregados; se houver qualquer perda ou falta, o sistema recompõe os registros padrão automaticamente.  
> 2) A funcionalidade de **Backup e Exportação Integral em JSON**, localizada na aba Banco de Dados, que permite ao gestor de segurança da instituição baixar uma cópia completa de todos os dados do SENAI com apenas um clique e restaurá-la a qualquer momento em qualquer máquina."*

### Pergunta 3: *"Quais normas técnicas de segurança do trabalho foram aplicadas na lógica do software?"*
> **Resposta ideal**:  
> *"O projeto foi construído respeitando as principais diretrizes regulamentadoras brasileiras:  
> - **NR-23 (Proteção Contra Incêndios)**: exige manutenção contínua, desobstrução das rotas de fuga e pessoas treinadas no uso dos equipamentos.  
> - **NBR 12962**: determina as inspeções visuais periódicas (nível 1 mensal/trimestral), recarga anual (nível 2) e ensaio hidrostático a cada 5 anos (nível 3). O sistema calcula os prazos de recarga e teste hidrostático e emite avisos de alerta visual antes do vencimento.  
> - **NBR 14276 / IT-17**: regulamenta a composição, dimensionamento e reciclagem periódica dos brigadistas."*

### Pergunta 4: *"Como funciona a segurança de acesso para impedir que funcionários alterem dados críticos?"*
> **Resposta ideal**:  
> *"Implementamos o padrão de controle de acesso baseado em papéis (**RBAC - Role-Based Access Control**). Definimos dois níveis estritos:  
> - O perfil **Administrador** (Melissa Jesus) possui permissão para excluir registros, cadastrar e resetar usuários e alterar o banco de dados.  
> - O perfil **Funcionário** (João Souza) possui acesso restrito às atividades de campo: realizar vistorias, consultar localização dos extintores e escanear QR Codes. A tela do Banco de Dados bloqueia ações administrativas caso o usuário logado não seja administrador."*
