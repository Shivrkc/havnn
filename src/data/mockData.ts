import { Repository, Deployment, Project, BuildLog } from '../types';

export const TRUSTED_COMPANIES = [
  { name: 'Linear', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg' },
  { name: 'Railway', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg' },
  { name: 'Supabase', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg' },
  { name: 'Sentry', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg' },
  { name: 'Prisma', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg' },
];

export const FEATURES = [
  {
    icon: 'GitBranch',
    title: 'Git-to-Cloud Workflows',
    description: 'Connect your GitHub, GitLab, or Bitbucket account. Every push triggers an atomic, zero-downtime deployment automatically.',
    badge: 'Core'
  },
  {
    icon: 'Zap',
    title: 'Global Edge Network',
    description: 'Deploy assets to over 100 global edge locations. Users experience ultra-low latency requests powered by HAVN Edge.',
    badge: 'Speed'
  },
  {
    icon: 'Terminal',
    title: 'Intelligent Build System',
    description: 'Automatic framework detection for React, Next.js, Remix, Vite, Go, Rust, and Node.js. Optimized dependency caching built-in.',
    badge: 'Smart'
  },
  {
    icon: 'Shield',
    title: 'SSL & Security by Default',
    description: 'Automated SSL certificate provisioning via Let’s Encrypt. Standard DDoS mitigation and web application firewalls (WAF).',
    badge: 'Secure'
  },
  {
    icon: 'Database',
    title: 'Integrated Databases',
    description: 'Spin up production-ready Serverless PostgreSQL or Redis databases in under 10 seconds, right alongside your compute nodes.',
    badge: 'New'
  },
  {
    icon: 'Cpu',
    title: 'Serverless & Edge Compute',
    description: 'Execute backend API routes and Edge Middleware instantly, scaling automatically from zero to millions of requests.',
    badge: 'Scalable'
  }
];

export const PRICING_PLANS = [
  {
    id: 'hobby',
    name: 'Hobby',
    tagline: 'For developers and side projects.',
    priceMonthly: 0,
    priceAnnually: 0,
    features: [
      '3 active personal projects',
      'Continuous Deployment via GitHub',
      'Free automated SSL certificates',
      '100 GB global edge bandwidth',
      '1 Serverless PostgreSQL (500MB)',
      'Community discord support'
    ],
    cta: 'Start for Free',
    popular: false
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For professional developers & small teams.',
    priceMonthly: 20,
    priceAnnually: 16,
    features: [
      'Unlimited projects & custom domains',
      'Collaborative shared workspaces (up to 5 team members)',
      '1 TB global edge bandwidth included',
      'Advanced Edge Middleware & redirects',
      '3 Serverless PostgreSQL databases (10GB each)',
      'Priority email and slack support (2hr SLA)'
    ],
    cta: 'Start 14-Day Free Trial',
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large organizations requiring scale & compliance.',
    priceMonthly: 120,
    priceAnnually: 99,
    features: [
      'Custom workspace sizing & self-hosted nodes',
      'Dedicated VPC and private network tunneling',
      'Enterprise-grade SLA & uptime guarantees (99.99%)',
      'Advanced RBAC permissions & Audit logs',
      'SAML / Single Sign-On (SSO)',
      'Dedicated Solution Architect & 24/7 phone support'
    ],
    cta: 'Contact Sales',
    popular: false
  }
];

export const FAQ_ITEMS = [
  {
    question: 'How does HAVN connect to my GitHub account?',
    answer: 'HAVN uses the official GitHub OAuth and App integrations. When you authorize HAVN, you can choose to grant access to either all of your repositories or specifically selected ones. We never read or store your personal raw credentials.'
  },
  {
    question: 'What frameworks does HAVN support out-of-the-box?',
    answer: 'We support all major frontend and full-stack frameworks including Vite, React, Next.js, Remix, Astro, SvelteKit, Vue, and Angular, as well as backend runtimes like Node.js, Go, Rust, Python (FastAPI), and Bun.'
  },
  {
    question: 'Can I use custom domains and obtain SSL certificates?',
    answer: 'Yes! Custom domains are fully supported on all plans, including our free Hobby plan. We automatically provision and renew wildcard SSL certificates via Let’s Encrypt immediately upon adding your domain.'
  },
  {
    question: 'What happens if my bandwidth usage exceeds my plan’s limit?',
    answer: 'We do not hard-block your projects immediately. For Hobby accounts, we will send warning notifications. For Pro accounts, extra bandwidth is charged transparently at $0.15 per GB, or you can scale up your tier.'
  },
  {
    question: 'Does HAVN support monorepos?',
    answer: 'Absolutely. During project setup, you can define custom root directories, build overrides, and output paths, making it simple to manage NX, Turbo, or Lerna monorepos.'
  },
  {
    question: 'Is serverless compute cold-start optimized?',
    answer: 'Yes, our proprietary runtime uses isolated V8 engine contexts, reducing serverless cold starts to under 15ms globally compared to standard VM micro-containers.'
  }
];

export const MOCK_REPOSITORIES: Repository[] = [
  { id: '1', name: 'personal-portfolio', owner: 'dev-master', branch: 'main', updatedAt: '2 hours ago', language: 'react' },
  { id: '2', name: 'fastapi-prediction-model', owner: 'dev-master', branch: 'main', updatedAt: 'Yesterday', language: 'python' },
  { id: '3', name: 'nest-graphql-api', owner: 'dev-master', branch: 'develop', updatedAt: '3 days ago', language: 'typescript' },
  { id: '4', name: 'go-distributed-cache', owner: 'dev-master', branch: 'main', updatedAt: '4 days ago', language: 'go' },
  { id: '5', name: 'react-dashboard-ui', owner: 'dev-master', branch: 'main', updatedAt: '1 week ago', language: 'react' },
  { id: '6', name: 'rust-compilers', owner: 'dev-master', branch: 'main', updatedAt: '2 weeks ago', language: 'rust' }
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'nexus-analytics-dashboard',
    repo: 'dev-master/nexus-analytics',
    owner: 'dev-master',
    branch: 'main',
    status: 'ready',
    url: 'https://nexus-analytics.havn.app',
    updatedAt: '12 minutes ago',
    deploymentsCount: 24
  },
  {
    id: 'p2',
    name: 'ecommerce-payment-service',
    repo: 'dev-master/stripe-checkout-node',
    owner: 'dev-master',
    branch: 'main',
    status: 'ready',
    url: 'https://payments.havn.app',
    updatedAt: '2 hours ago',
    deploymentsCount: 42
  },
  {
    id: 'p3',
    name: 'ai-storyteller-client',
    repo: 'dev-master/ai-image-generator',
    owner: 'dev-master',
    branch: 'main',
    status: 'building',
    url: 'https://storyteller.havn.app',
    updatedAt: 'Just now',
    deploymentsCount: 8
  }
];

export const MOCK_DEPLOYMENTS: Deployment[] = [
  {
    id: 'd1',
    projectId: 'p1',
    projectName: 'nexus-analytics-dashboard',
    status: 'ready',
    branch: 'main',
    commitMsg: 'feat: add realtime retention cohort charts',
    commitHash: '7f9a2d4',
    deployedAt: '12 mins ago',
    url: 'https://nexus-analytics-7f9a2d4.havn.app',
    environment: 'production',
    durationMs: 72000
  },
  {
    id: 'd2',
    projectId: 'p1',
    projectName: 'nexus-analytics-dashboard',
    status: 'ready',
    branch: 'staging',
    commitMsg: 'Update Prometheus alerting thresholds',
    commitHash: 'c42d90a',
    commitAuthor: 'Sarah Chen',
    deployedAt: '4 hours ago',
    url: 'https://nexus-analytics-c42d90a.havn.app',
    environment: 'preview',
    durationMs: 54000
  },
  {
    id: 'd3',
    projectId: 'p2',
    projectName: 'ecommerce-payment-service',
    status: 'ready',
    branch: 'main',
    commitMsg: 'fix: validate stripe webhook secure signature headers',
    commitHash: 'e182bd5',
    deployedAt: '2 hours ago',
    url: 'https://payments-e182bd5.havn.app',
    environment: 'production',
    durationMs: 124000
  },
  {
    id: 'd4',
    projectId: 'p3',
    projectName: 'ai-storyteller-client',
    status: 'building',
    branch: 'main',
    commitMsg: 'chore: configure deep gemini integration logic',
    commitHash: '9a0bf21',
    deployedAt: 'Just now',
    url: 'https://storyteller-9a0bf21.havn.app',
    environment: 'preview',
    durationMs: 42000
  }
];

export const SIMULATED_BUILD_STEPS: BuildLog[] = [
  { timestamp: '14:22:05', type: 'info', message: 'Cloning repository dev-master/ai-image-generator (branch: main)...' },
  { timestamp: '14:22:06', type: 'info', message: 'Selected build container node:18-alpine.' },
  { timestamp: '14:22:08', type: 'success', message: 'Repository cloned successfully. Commit [9a0bf21] detected.' },
  { timestamp: '14:22:09', type: 'info', message: 'Checking dependencies cache... no hit found.' },
  { timestamp: '14:22:11', type: 'info', message: 'Installing package dependencies using npm ci...' },
  { timestamp: '14:22:17', type: 'success', message: 'Successfully installed 412 npm packages.' },
  { timestamp: '14:22:18', type: 'info', message: 'Running build script (npm run build)...' },
  { timestamp: '14:22:20', type: 'info', message: '> tsc && vite build' },
  { timestamp: '14:22:24', type: 'info', message: 'vite v6.2.3 compiling target client-bundle...' },
  { timestamp: '14:22:28', type: 'success', message: 'Build compilation succeeded.' },
  { timestamp: '14:22:29', type: 'info', message: 'Output directory "dist/" detected (Size: 1.4 MB).' },
  { timestamp: '14:22:30', type: 'info', message: 'Optimizing static asset compressions with Gzip and Brotli...' },
  { timestamp: '14:22:32', type: 'info', message: 'Uploading 14 static assets to global Edge CDN nodes...' },
  { timestamp: '14:22:33', type: 'success', message: 'Edge CDN distribution synced successfully (108 nodes).' },
  { timestamp: '14:22:34', type: 'info', message: 'Provisioning automated SSL wildcard credentials for storyteller.cloudforge.app...' },
  { timestamp: '14:22:36', type: 'success', message: 'SSL certificate active.' },
  { timestamp: '14:22:37', type: 'success', message: 'Deployment SUCCESSFUL! Application is LIVE at storyteller.cloudforge.app 🎉' }
];
