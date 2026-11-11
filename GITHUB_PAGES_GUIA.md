# 🚀 Como Subir o Projeto no GitHub Pages

Este guia passo a passo ensina como subir o sistema de combate a incêndio do SENAI no GitHub e publicá-lo gratuitamente no **GitHub Pages**.

---

### 📦 1. Limpeza e Otimização Já Realizadas
- O vídeo pesado de teste (60 MB) e capturas não utilizadas foram excluídos. O projeto agora tem apenas **~320 KB** em assets, ficando ultra leve e rápido de carregar.
- A configuração do Vite (`vite.config.ts`) já está com `base: './'`, garantindo que todos os links, estilos e scripts funcionem em qualquer endereço do GitHub Pages (`https://seu-usuario.github.io/nome-do-repositorio/`).
- O fluxo automático do **GitHub Actions** já foi criado em `.github/workflows/deploy.yml`.

---

### 🛠️ 2. Passo a Passo para Subir no GitHub

#### Passo A: Criar um repositório no GitHub
1. Acesse [github.com](https://github.com) e entre na sua conta.
2. Clique no botão verde **"New"** (Novo repositório).
3. Dê um nome ao repositório, por exemplo: `senai-brigada-incendio`.
4. Escolha **Public** (Público) para usar o GitHub Pages gratuito.
5. **Não** marque "Add a README file" nem ".gitignore" (pois o projeto já tem).
6. Clique em **"Create repository"**.

#### Passo B: Enviar os arquivos pelo terminal (ou Git Desktop)
No terminal do seu computador (na pasta do projeto), execute:

```bash
# 1. Iniciar o Git (caso ainda não esteja iniciado)
git init

# 2. Adicionar todos os arquivos otimizados
git add .

# 3. Criar o commit inicial
git commit -m "feat: Sistema de Brigada de Incêndio SENAI com QR Code e 123 extintores"

# 4. Renomear o branch principal para main
git branch -M main

# 5. Conectar com o seu repositório no GitHub (substitua com o seu usuário e nome do repo)
git remote add origin https://github.com/SEU-USUARIO/senai-brigada-incendio.git

# 6. Enviar para o GitHub
git push -u origin main
```

---

### 🌐 3. Ativar o GitHub Pages em 2 Cliques

1. No seu repositório no GitHub, clique na aba **Settings** (Configurações).
2. No menu lateral esquerdo, clique em **Pages**.
3. Em **Build and deployment** > **Source**, selecione:
   - **GitHub Actions** (Recomendado! O arquivo `.github/workflows/deploy.yml` criado fará o build e publicação automáticos a cada commit).
4. Aguarde cerca de 1 a 2 minutos enquanto a ação roda na aba **Actions**.
5. Pronto! O GitHub Pages exibirá o link oficial do seu site no topo da página de configurações:
   `https://SEU-USUARIO.github.io/senai-brigada-incendio/`

---

### 📱 4. Dica para Uso da Câmera / QR Code no GitHub Pages
- O GitHub Pages fornece automaticamente certificado **HTTPS** gratuito e seguro (`https://...`), o que é **obrigatório** para os navegadores de celular e computadores permitirem o acesso à câmera do dispositivo.
- Ao abrir o site pelo celular no GitHub Pages, o botão de ler QR Code funcionará diretamente na câmera traseira do seu smartphone!
