# Threat Model — AgroGestor

Análise simplificada baseada em STRIDE (Spoofing, Tampering, Repudiation,
Information Disclosure, Denial of Service, Elevation of Privilege), aplicada
aos pontos concretos do sistema.

## 1. Ativos a proteger
- Credenciais de acesso (senha).
- Dados pessoais do agricultor (nome, e-mail, localização da propriedade) — sujeitos à LGPD.
- Histórico de plantio, aplicações e dados financeiros (sensível para o negócio do usuário, ainda que não regulado).

## 2. Ameaças identificadas e mitigação

| Ameaça (STRIDE) | Cenário concreto | Mitigação |
|---|---|---|
| Spoofing | Alguém se autentica como outro usuário | Senha com hash forte (PBKDF2/Argon2 via Django), JWT assinado com chave secreta forte, HTTPS obrigatório em produção |
| Tampering | Alguém altera dados de aplicação de outro usuário | Toda escrita valida `usuario_id` do objeto contra `request.user` antes de persistir |
| Information Disclosure (IDOR) | Usuário A troca o ID na URL (`/plantios/7/`) e acessa dado do usuário B | **Nunca** confiar no ID da URL isoladamente — todo `queryset` filtra primeiro por `request.user`, e o objeto só é retornado se pertencer a ele (404 em vez de 403, para não revelar existência do recurso de outro usuário) |
| Information Disclosure (logs) | Dado pessoal (nome, localização) vazando em logs de erro | Configurar logging para não registrar corpo de requisição em rotas com dados pessoais; usar variáveis de ambiente para segredos, nunca hardcoded |
| Denial of Service | Brute-force no login | Rate limiting no endpoint de login (ex.: `django-ratelimit`), bloqueio temporário após N tentativas |
| Elevation of Privilege | Endpoint do admin exposto sem autenticação adequada | Admin do Django restrito a superusuários, nunca exposto como parte da API pública consumida pelo frontend |
| Elevation of Privilege | Endpoint de disparo do job diário de notificações (ADR 006) acionado por qualquer pessoa, gerando spam de notificação ou custo indevido | Endpoint protegido por chave secreta enviada no header (não em query string), comparada com `secrets.compare_digest` para evitar timing attack; nunca acessível sem essa chave |
| Tampering (cross-tenant) | Atacante que descobre o `endpoint` de push de outra conta reenvia esse mesmo `endpoint` via `POST /push-subscriptions/`, reatribuindo a subscription para si (`update_or_create` por `endpoint`, ver Task 3); o dispositivo da vítima passa a receber notificações com conteúdo do atacante (risco phishing-adjacent) e a vítima para de receber as suas | Comportamento deliberado, não é um bug: valores de `endpoint` são gerados pelo navegador, longos e efetivamente impossíveis de adivinhar, e nunca são expostos a outro usuário por nenhum endpoint de leitura (`UsuarioScopedQuerySetMixin` impede qualquer usuário de listar/ler a subscription de outra conta para descobrir seu `endpoint`) |
| Repudiation | Usuário nega ter feito determinada aplicação de insumo | Registros de auditoria com timestamp e usuário responsável em `AplicacaoInsumo` (campo `created_by`, `created_at` imutáveis) |

## 3. Checklist de segurança para produção
- [ ] HTTPS obrigatório (redirect automático de HTTP)
- [ ] `SECRET_KEY` e credenciais de banco via variáveis de ambiente, nunca no repositório
- [ ] CORS restrito ao domínio exato do frontend em produção
- [ ] Access token JWT de curta duração + refresh token em cookie HttpOnly
- [ ] Rate limiting no login e em endpoints de escrita
- [ ] Backup automático do banco (recurso nativo do provedor gerenciado)
- [ ] Validação de entrada em todos os campos numéricos (área, dosagem, quantidade) contra valores negativos ou fora de faixa plausível
- [ ] Dependências com scan de vulnerabilidade (ex.: `pip-audit`, Dependabot no GitHub)

## 4. LGPD — pontos mínimos de conformidade
- Coletar apenas os dados pessoais necessários (nome, e-mail; localização apenas se o usuário optar por informar).
- Ter uma página simples de política de privacidade explicando o que é coletado e por quê.
- Permitir que o usuário solicite exclusão da própria conta e dados (endpoint ou processo manual documentado é suficiente no MVP).
