/**
 * HAVN AI Scope Guard & Technical Learning Router.
 * 
 * Deterministic, zero-Gemini-cost local intent and domain classifier.
 * Evaluates user questions and partitions them into:
 *   1. DEPLOYMENT - Current build logs, container errors, pipeline status, config.
 *   2. LEARNING   - General software engineering, cloud, DevOps, container, database, and system design concepts.
 *   3. UNSUPPORTED - General lifestyle, personal, dating, entertainment, creative writing, or non-technical topics.
 */

export type AiScope = "deployment" | "learning" | "unsupported";

export interface ScopeClassificationResult {
  scope: AiScope;
  confidence: number;
  domain?: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// 1. High-Confidence Pure Unsupported Intent Patterns
// ---------------------------------------------------------------------------
// These patterns capture explicit entertainment, creative writing, dating, and
// lifestyle requests where the user is asking for a joke, poem, romantic advice,
// food recommendation, etc., even if a technical noun is mentioned.
const CREATIVE_AND_ENTERTAINMENT_INTENTS = [
  /\b(tell|write|give|make|generate|recite|compose|sing)\s+(me\s+)?(a\s+)?(joke|jokes|pun|puns|riddle|riddles|poem|poems|poetry|song|songs|story|stories|ballad|haiku|pickup\s+line)\b/i,
  /\b(tell|crack)\s+(me\s+)?(a\s+)?(joke|pun|riddle)\b/i,
  /\bwrite\s+(me\s+)?(a\s+)?(poem|story|song|haiku|ballad|love\s+letter|romantic\s+message)\b/i,
  /\b(recommend|suggest)\s+(me\s+)?(a\s+)?(movie|film|tv\s+show|series|anime|song|music|album|video\s+game|game)\b/i,
  /\b(what|which)\s+(movie|film|tv\s+show|series|song)\s+(should\s+i|to)\s+(watch|see|listen)\b/i,
];

const LIFESTYLE_AND_PERSONAL_INTENTS = [
  /\b(dating|relationship|romance|crush|girlfriend|boyfriend|husband|wife|dating\s+app)\s+(advice|tips|help)\b/i,
  /\bhow\s+(can|do|to)\s+i\s+(approach|talk\s+to|impress|ask\s+out|flirt\s+with|date|attract|kiss|marry)\s+(a\s+)?(girl|boy|guy|woman|women|man|men|crush|someone)\b/i,
  /\b(who\s+should\s+i\s+date|how\s+to\s+get\s+a\s+(girlfriend|boyfriend))\b/i,
  /\bwrite\s+(a\s+)?(romantic|love)\s+(message|letter|text|dm|note)\b/i,
  /\b(what\s+should\s+i|what\s+to)\s+(eat|cook|make|order)\s+(for\s+|tonight|today|dinner|lunch|breakfast)\b/i,
  /\b(recipe|recipes|ingredients)\s+(for|to\s+cook|to\s+make)\b/i,
  /\bhow\s+to\s+(cook|bake|make)\s+(pasta|pizza|cake|cookies|chicken|biryani|curry|soup|food|bread)\b/i,
  /\bhow\s+(can|do)\s+i\s+(lose\s+weight|burn\s+fat|build\s+muscle|gain\s+weight)\b/i,
  /\b(workout|gym|diet)\s+(plan|routine|tips)\b/i,
  /\b(horoscope|astrology|zodiac|tarot)\b/i,
  /\bwho\s+won\s+the\s+(world\s+cup|match|game|super\s+bowl|ipl|champions\s+league|tournament)\b/i,
  /\b(what\s+is\s+the\s+capital\s+of|population\s+of|weather\s+in|who\s+is\s+the\s+president\s+of)\b/i,
];

// ---------------------------------------------------------------------------
// 2. High-Priority Deployment Indicators
// ---------------------------------------------------------------------------
// Specific phrases indicating the user is referring to the current deployment,
// build execution, container build logs, or failure state.
const DEPLOYMENT_STRONG_SIGNALS = [
  /\b(this|my|the)\s+(deployment|build|build\s+log|buildlog|docker\s*build|image\s*build|project)\b/i,
  /\b(this|my|the)\s+(error|failure|crash|stack\s*trace|exception|bug|issue)\b/i,
  /\b(why\s+(did|is)\s+(this|my|the)\s+(build|deployment|image|container|docker\s*build)\s+(fail|failing|failed|stuck|timeout|crash|break))\b/i,
  /\b(why\s+did\s+it\s+(fail|crash|break|timeout))\b/i,
  /\b(what\s+(went\s+wrong|happened)\s+(with|in)\s+(this|my|the)?\s*(build|deployment|logs?))\b/i,
  /\b(which|what)\s+log\s+(line|entry|sequence)?\s*(caused|shows)\b/i,
  /\b(seq|sequence)\s*#?\s*\d+\b/i,
  /\bwhat\s+happened\s+in\s+(build\s+)?log(\s+sequence)?\s*#?\d+/i,
  /\bexit\s+code\s+[1-9]\d*\b/i,
  /\b(how\s+can\s+i|how\s+to)\s+(fix|resolve|debug|optimize)\s+(this|my)\s+(build|deployment|error|failure)\b/i,
  /\b(npm\s+ERR!|ERESOLVE|command\s+failed|fatal:\s+unable\s+to\s+access|cannot\s+find\s+module)\b/i,
  /\b(peer\s+dependency\s+conflict|dependency\s+conflict|package\s+conflict)\b/i,
  /\bwhy\s+did\s+(the\s+)?(npm|yarn|pnpm|dependency|peer\s+dependency|docker|build|install|compile|step)\b/i,
  /\b(package\s+installation|dependency\s+resolution)\s+(fail|failure|error|conflict)\b/i,
];

// ---------------------------------------------------------------------------
// 3. Technical Learning Taxonomy (15 Domains Grounded in Havn)
// ---------------------------------------------------------------------------
interface TechnicalDomain {
  name: string;
  patterns: RegExp[];
  keywords: string[];
}

const TECHNICAL_DOMAINS: TechnicalDomain[] = [
  {
    name: "Docker & Containers",
    patterns: [
      /\bdocker\b/i,
      /\bdockerfile\b/i,
      /\bdocker-compose\b/i,
      /\bcontainer(s|ization|ize|ized)?\b/i,
      /\b(multi-stage\s+build|container\s+image|image\s+layer|docker\s+daemon|containerd|cgroups?|namespaces?)\b/i,
      /\b(entrypoint|docker\s+volume|docker\s+network|buildkit)\b/i,
    ],
    keywords: ["docker", "container", "containers", "containerization", "dockerfile", "compose", "containerd", "cgroups", "buildkit"],
  },
  {
    name: "Kubernetes & Orchestration",
    patterns: [
      /\b(kubernetes|k8s|kubectl)\b/i,
      /\b(container\s+orchestration|orchestrate\s+containers?)\b/i,
      /\b(pod|pods|daemonset|statefulset|configmap|ingress(\s+controller)?|helm\s+chart|kubelet|control\s+plane|etcd|hpa)\b/i,
    ],
    keywords: ["kubernetes", "k8s", "kubectl", "orchestration", "pod", "pods", "daemonset", "statefulset", "ingress", "helm", "kubelet", "etcd"],
  },
  {
    name: "CI/CD & DevOps",
    patterns: [
      /\bci\s*\/\s*cd\b/i,
      /\bcicd\b/i,
      /\b(continuous\s+integration|continuous\s+delivery|continuous\s+deployment)\b/i,
      /\b(github\s+actions?|gitlab\s+ci|jenkins|circleci|argo\s*cd|gitops)\b/i,
      /\b(build\s+pipeline|deployment\s+pipeline|pipeline\s+stage|pipeline\s+runner|automated\s+deploy(ment)?)\b/i,
      /\b(blue-green|canary\s+deploy(ment)?|rolling\s+update)\b/i,
    ],
    keywords: ["ci/cd", "cicd", "pipeline", "pipelines", "devops", "gitops", "jenkins", "argocd", "actions", "runner"],
  },
  {
    name: "Cloud Infrastructure & AWS",
    patterns: [
      /\b(cloud\s+computing|cloud\s+architecture|cloud\s+provider|cloud\s+infrastructure)\b/i,
      /\b(aws|amazon\s+web\s+services|gcp|google\s+cloud|azure)\b/i,
      /\b(ec2|s3|vpc|iam|lambda|serverless|ecs|eks|fargate|cloudfront|route\s*53|cloudwatch|elastic\s+beanstalk)\b/i,
      /\b(virtual\s+private\s+cloud|security\s+group|nat\s+gateway|internet\s+gateway|load\s+balancer|alb|nlb)\b/i,
      /\b(infrastructure\s+as\s+code|iac|terraform|cloudformation)\b/i,
    ],
    keywords: ["cloud", "aws", "gcp", "azure", "ec2", "s3", "vpc", "iam", "lambda", "serverless", "fargate", "terraform", "iac"],
  },
  {
    name: "Networking",
    patterns: [
      /\b(cloud\s+networking|computer\s+networking|container\s+networking)\b/i,
      /\b(reverse\s+proxy|forward\s+proxy|proxy\s+server|nginx|traefik|envoy|caddy)\b/i,
      /\b(dns|tcp(\/ip)?|udp|ip\s+address|ipv4|ipv6|cidr|subnet|subnetting)\b/i,
      /\b(http|https|http\/2|http\/3|websocket|websockets|ssl|tls|ssl\/tls|tls\s+handshake)\b/i,
      /\b(load\s+balancing|load\s+balancer|latency|throughput|packet\s+loss|firewall)\b/i,
    ],
    keywords: ["networking", "network", "proxy", "nginx", "dns", "tcp", "udp", "http", "https", "websocket", "ssl", "tls", "cidr", "subnet"],
  },
  {
    name: "Backend & APIs",
    patterns: [
      /\b(rest|restful)\s+api(s)?\b/i,
      /\b(graphql|grpc|rpc|openapi|swagger|webhook|webhooks)\b/i,
      /\b(api\s+gateway|api\s+endpoint|api\s+design|api\s+security|secure\s+.*api)\b/i,
      /\b(node\.?js|express\.?js|express|fastify|nestjs|django|flask|fastapi|spring\s+boot|golang|rust|gin)\b/i,
      /\b(microservices?|monolith|monolithic|event-driven|message\s+queue|kafka|rabbitmq|sqs)\b/i,
    ],
    keywords: ["api", "apis", "rest", "restful", "graphql", "grpc", "endpoint", "webhook", "express", "microservices", "kafka", "backend"],
  },
  {
    name: "Databases & Storage",
    patterns: [
      /\b(database|databases|rdbms|nosql)\b/i,
      /\b(postgres|postgresql|mysql|sqlite|mongodb|redis|cassandra|dynamodb)\b/i,
      /\b(sql|sql\s+query|sql\s+queries|indexing|b-tree|gin\s+index|btree)\b/i,
      /\b(orm|prisma|typeorm|sequelize|sqlalchemy|drizzle)\b/i,
      /\b(database\s+migration|db\s+migration|acid|database\s+transaction|sharding|replication|connection\s+pool)\b/i,
    ],
    keywords: ["database", "postgres", "postgresql", "mysql", "redis", "prisma", "sql", "indexing", "queries", "orm", "sharding", "acid"],
  },
  {
    name: "Authentication & Security",
    patterns: [
      /\bauthentication\s+vs\s+authorization\b/i,
      /\b(authentication|authorization|authn|authz)\b/i,
      /\b(oauth|oauth\s*2\.?0?|jwt|json\s+web\s+tokens?|session\s+token|bearer\s+token)\b/i,
      /\b(cors|csrf|xss|sql\s+injection|owasp|zero\s+trust|encryption|hashing|bcrypt|argon2)\b/i,
      /\b(rbac|role-based\s+access|iam\s+policy|public\s+key|private\s+key|api\s+key)\b/i,
    ],
    keywords: ["authentication", "authorization", "oauth", "jwt", "token", "cors", "csrf", "xss", "encryption", "hashing", "bcrypt", "rbac", "security"],
  },
  {
    name: "Git & Version Control",
    patterns: [
      /\b(git|github|gitlab|bitbucket)\b/i,
      /\b(git\s+branch(ing)?|git\s+commit|git\s+merge|git\s+rebase|git\s+checkout|git\s+cherry-pick|git\s+stash)\b/i,
      /\b(pull\s+request|merge\s+conflict|pull\s+requests|git\s+submodule|git\s+hook|git\s+workflow)\b/i,
    ],
    keywords: ["git", "github", "gitlab", "commit", "branch", "rebase", "merge", "repo", "repository"],
  },
  {
    name: "Monitoring & Observability",
    patterns: [
      /\b(monitoring|observability|telemetry)\b/i,
      /\b(prometheus|grafana|datadog|new\s*relic|sentry|opentelemetry|otel|jaeger)\b/i,
      /\b(distributed\s+tracing|log\s+aggregation|elk\s+stack|loki|fluentd|cloudwatch\s+logs)\b/i,
      /\b(health\s+check|liveness\s+probe|readiness\s+probe|sli|slo|sla|uptime|downtime)\b/i,
    ],
    keywords: ["monitoring", "observability", "prometheus", "grafana", "telemetry", "tracing", "metrics", "logging", "sentry", "alerting"],
  },
  {
    name: "AI & Machine Learning",
    patterns: [
      /\b(machine\s+learning|deep\s+learning|artificial\s+intelligence)\b/i,
      /\b(llm|large\s+language\s+model|transformers?|gpt|gemini|claude)\b/i,
      /\b(vector\s+database|embeddings?|rag|retrieval\s+augmented|prompt\s+engineering)\b/i,
      /\b(neural\s+network|fine-tuning|model\s+inference|tokenization|tokens)\b/i,
    ],
    keywords: ["machine learning", "deep learning", "llm", "transformers", "embeddings", "rag", "ai"],
  },
  {
    name: "Frontend & Web Engineering",
    patterns: [
      /\b(react|vue|angular|svelte|next\.?js|vite|webpack|tailwind|tailwindcss)\b/i,
      /\b(typescript|javascript|dom|browser\s+rendering|client-side|server-side\s+rendering|ssr|csr|spa)\b/i,
      /\b(bundle\s+size|code\s+splitting|lazy\s+loading|state\s+management|redux|zustand)\b/i,
    ],
    keywords: ["react", "frontend", "typescript", "javascript", "vite", "webpack", "tailwind", "ssr", "spa", "browser"],
  },
  {
    name: "Software Engineering & Architecture",
    patterns: [
      /\b(software\s+architecture|software\s+engineering|system\s+design)\b/i,
      /\b(horizontal\s+scaling|vertical\s+scaling|scalability|high\s+availability|fault\s+tolerance)\b/i,
      /\b(solid\s+principles|clean\s+architecture|design\s+patterns?|dependency\s+injection)\b/i,
      /\b(unit\s+testing|integration\s+testing|e2e\s+testing|test\s+driven|tdd|mocking)\b/i,
      /\b(concurrency|multithreading|async\s+await|event\s+loop|memory\s+leak|garbage\s+collection)\b/i,
      /\b(npm|yarn|pnpm|pip|cargo|maven|gradle|dependencies|dependency|package\.json|lockfile)\b/i,
    ],
    keywords: ["system design", "scaling", "scalability", "architecture", "solid", "testing", "concurrency", "async", "npm", "dependency", "package"],
  },
];

// Technical inquiry question starters
const TECHNICAL_INQUIRY_PATTERNS = [
  /\bwhat\s+(is|are)\s+([a-z0-9_\-\s]+)\b/i,
  /\bwhy\s+(do\s+we\s+use|is|are|should\s+i\s+use)\s+([a-z0-9_\-\s]+)\b/i,
  /\bhow\s+(does|do|can|is)\s+([a-z0-9_\-\s]+)\s+(work|function|operate|scale)\b/i,
  /\bexplain\s+([a-z0-9_\-\s]+)\b/i,
  /\bdifference\s+between\s+([a-z0-9_\-\s]+)\s+and\s+([a-z0-9_\-\s]+)\b/i,
  /\bcompare\s+([a-z0-9_\-\s]+)\s+(to|with|and)\s+([a-z0-9_\-\s]+)\b/i,
  /\bhow\s+to\s+(use|implement|configure|deploy|scale|secure|optimize|test)\s+([a-z0-9_\-\s]+)\b/i,
  /\bbest\s+practices?\s+for\s+([a-z0-9_\-\s]+)\b/i,
];

/**
 * Classifies a user question into DEPLOYMENT, LEARNING, or UNSUPPORTED.
 * Deterministic local execution with 0 Gemini calls and sub-millisecond execution.
 */
export function classifyQuestionScope(question: string): ScopeClassificationResult {
  const q = question.trim();
  if (!q) {
    return {
      scope: "unsupported",
      confidence: 1.0,
      reason: "Empty query string provided.",
    };
  }

  const lowerQ = q.toLowerCase();

  // -------------------------------------------------------------------------
  // STEP 1: Check Explicit Creative / Entertainment / Joke / Poem Intents
  // -------------------------------------------------------------------------
  // Requests like "Tell me a joke about Docker" or "Write a poem about Kubernetes"
  // must be rejected as UNSUPPORTED even if a technical noun is mentioned.
  for (const pattern of CREATIVE_AND_ENTERTAINMENT_INTENTS) {
    if (pattern.test(q)) {
      return {
        scope: "unsupported",
        confidence: 0.98,
        reason: "Matched creative writing, joke, poem, or entertainment intent.",
      };
    }
  }

  // -------------------------------------------------------------------------
  // STEP 2: Check High-Priority Deployment Signals
  // -------------------------------------------------------------------------
  // If the user is referring to the current build, logs, error trace, or failure.
  for (const signal of DEPLOYMENT_STRONG_SIGNALS) {
    if (signal.test(q)) {
      return {
        scope: "deployment",
        confidence: 0.95,
        reason: "Matched explicit deployment context or build log signal.",
      };
    }
  }

  // -------------------------------------------------------------------------
  // STEP 3: Check Technical Domain Matching (Learning Scope)
  // -------------------------------------------------------------------------
  // Evaluates domain regex patterns and keyword matches across the 15 domains.
  let matchedDomain: string | undefined;
  let technicalMatches = 0;

  for (const domain of TECHNICAL_DOMAINS) {
    let domainMatched = false;
    for (const pattern of domain.patterns) {
      if (pattern.test(q)) {
        domainMatched = true;
        technicalMatches += 2;
        if (!matchedDomain) matchedDomain = domain.name;
        break;
      }
    }

    if (!domainMatched) {
      for (const kw of domain.keywords) {
        // Match whole word for keywords
        const kwRegex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (kwRegex.test(lowerQ)) {
          technicalMatches += 1;
          if (!matchedDomain) matchedDomain = domain.name;
          break;
        }
      }
    }
  }

  // Check if query is structured as a technical learning inquiry
  let hasInquiryStructure = false;
  for (const pattern of TECHNICAL_INQUIRY_PATTERNS) {
    if (pattern.test(q)) {
      hasInquiryStructure = true;
      break;
    }
  }

  // -------------------------------------------------------------------------
  // STEP 4: Check Lifestyle, Dating, and Personal Advice Intents
  // -------------------------------------------------------------------------
  // IMPORTANT NUANCE:
  // "How do I secure a dating website API?" contains "dating", BUT it has:
  // - technicalMatches >= 2 (matched "api" and "secure")
  // - technical inquiry structure "how do i secure ... api"
  // Therefore, only reject lifestyle/dating patterns if technicalMatches < 2!
  for (const pattern of LIFESTYLE_AND_PERSONAL_INTENTS) {
    if (pattern.test(q)) {
      // If the query has significant technical engineering substance (e.g. securing an API for a dating app)
      // and does NOT ask for personal/dating advice, allow it to pass to learning.
      const isActuallyTechnicalInquiry =
        technicalMatches >= 2 &&
        /\b(api|database|server|security|docker|kubernetes|backend|code|app|website|encryption|auth|authz|jwt|sql)\b/i.test(q) &&
        !/\b(approach|ask\s+out|flirt|kiss|marry|date\s+me|love\s+me|dating\s+advice|relationship\s+advice)\b/i.test(q);

      if (!isActuallyTechnicalInquiry) {
        return {
          scope: "unsupported",
          confidence: 0.95,
          reason: "Matched lifestyle, dating, food, sports, or personal advice pattern.",
        };
      }
    }
  }

  // -------------------------------------------------------------------------
  // STEP 5: Final Arbitration for Learning vs Unsupported
  // -------------------------------------------------------------------------
  // If matched at least one technical domain pattern or strong technical keyword
  if (technicalMatches > 0) {
    return {
      scope: "learning",
      confidence: hasInquiryStructure ? 0.95 : 0.85,
      domain: matchedDomain,
      reason: `Matched technical domain: ${matchedDomain || "General Engineering"}.`,
    };
  }

  // If there's an inquiry structure but no technical domain matched (e.g. "What should I eat tonight?"):
  // Ambiguous queries with 0 technical matches must be rejected locally to protect Gemini quota.
  return {
    scope: "unsupported",
    confidence: 0.8,
    reason: "No recognized deployment context or technical engineering domain identified.",
  };
}
