import { PrismaClient, Difficulty, TopicStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.STUDY_PLANNER_USER_EMAIL ?? "student@local.studywell";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: process.env.STUDY_PLANNER_USER_NAME ?? "Student",
      email,
      dailyStudyHours: 3,
    },
  });

  console.log(`Seeding engineering curriculum for user: ${user.name} (${user.id})`);

  // 1. Remove topic named 'A' in ROSP
  const topicA = await prisma.topic.findFirst({
    where: {
      name: { equals: "A" },
      subject: { userId: user.id },
    },
  });

  if (topicA) {
    console.log(`Found dummy topic "A" (id: ${topicA.id}). Removing...`);
    // Delete related records first
    await prisma.quizAttempt.deleteMany({ where: { topicId: topicA.id } });
    await prisma.quizQuestion.deleteMany({ where: { topicId: topicA.id } });
    await prisma.studySession.deleteMany({ where: { topicId: topicA.id } });
    await prisma.topic.delete({ where: { id: topicA.id } });
    console.log(`Removed topic "A" successfully.`);
  }

  // 2. Check ROSP subject - add meaningful robotics engineering topics if empty
  const rosp = await prisma.subject.findFirst({
    where: { userId: user.id, name: { contains: "ROSP" } },
    include: { topics: true },
  });

  if (rosp && rosp.topics.length === 0) {
    console.log("Adding valid engineering topics to ROSP...");
    await prisma.topic.createMany({
      data: [
        {
          subjectId: rosp.id,
          name: "ROS2 Nodes, Topics & DDS Middleware",
          difficulty: Difficulty.MEDIUM,
          estimatedHours: 5,
          status: TopicStatus.ACTIVE,
        },
        {
          subjectId: rosp.id,
          name: "URDF Kinematic Trees & TF2 Coordinate Frames",
          difficulty: Difficulty.HARD,
          estimatedHours: 6,
          status: TopicStatus.ACTIVE,
        },
      ],
    });
  }

  // Dates for upcoming exams
  const today = new Date();
  const datePlusDays = (days: number) => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() + days);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  };

  const engineeringCurriculum = [
    {
      name: "Software Engineering",
      examDate: datePlusDays(18),
      topics: [
        {
          name: "Agile, Scrum & Sprint Lifecycle",
          difficulty: Difficulty.MEDIUM,
          estimatedHours: 4,
          questions: [
            {
              question: "In Scrum, what is the primary purpose of the Daily Standup (Daily Scrum)?",
              options: [
                "To report individual hours directly to executive management.",
                "To inspect progress toward the Sprint Goal and synchronize the day's plan.",
                "To conduct detailed technical code reviews and refactoring.",
                "To negotiate scope increases with the Product Owner.",
              ],
              correctAnswer: "B",
              explanation: "The Daily Scrum is a 15-minute time-boxed event for developers to inspect progress toward the Sprint Goal and adapt the Sprint Backlog.",
            },
            {
              question: "Which Agile metric measures the amount of work a development team completes during a single sprint?",
              options: ["Velocity", "Lead Time", "Code Churn", "Cyclomatic Complexity"],
              correctAnswer: "A",
              explanation: "Velocity is the measure of the quantity of user story points a team completes in a sprint.",
            },
            {
              question: "What does the 'Definition of Done' (DoD) ensure in an Agile product delivery cycle?",
              options: [
                "That the software is bug-free forever.",
                "A shared understanding of quality criteria that an increment must satisfy to be releasable.",
                "That developers can cease all documentation efforts.",
                "That no more features will ever be added to the product.",
              ],
              correctAnswer: "B",
              explanation: "The DoD provides a formal checklist of quality, test, and release criteria that every story must meet to be considered completed.",
            },
          ],
        },
        {
          name: "Design Patterns (GoF: Creational & Structural)",
          difficulty: Difficulty.HARD,
          estimatedHours: 5,
          questions: [
            {
              question: "Which Design Pattern encapsulates object creation logic, letting subclasses decide which class to instantiate?",
              options: ["Factory Method", "Singleton", "Decorator", "Observer"],
              correctAnswer: "A",
              explanation: "The Factory Method defines an interface for creating an object, but lets subclasses decide which exact class to instantiate.",
            },
            {
              question: "How does the Observer Pattern decouple subjects and observers in event-driven systems?",
              options: [
                "By using concrete inheritance trees for every event type.",
                "By maintaining a list of subscriber interfaces notified when subject state changes.",
                "By serializing all messages into global static database tables.",
                "By eliminating callbacks and polling every thread.",
              ],
              correctAnswer: "B",
              explanation: "Subjects maintain a collection of observer interfaces, allowing dynamic subscription and broadcasting without compile-time coupling.",
            },
            {
              question: "Which design pattern is best suited for attaching additional responsibilities to an object dynamically without subclassing?",
              options: ["Decorator", "Adapter", "Facade", "Flyweight"],
              correctAnswer: "A",
              explanation: "Decorator wraps an existing component and adds behavior dynamically conforming to the same interface.",
            },
          ],
        },
        {
          name: "CI/CD Pipelines & DevOps Automation",
          difficulty: Difficulty.MEDIUM,
          estimatedHours: 4,
          questions: [
            {
              question: "What is the key difference between Continuous Delivery and Continuous Deployment?",
              options: [
                "Continuous Delivery automates deployments to production without human intervention.",
                "Continuous Deployment automatically deploys every passing build directly to production.",
                "Continuous Delivery requires no unit or integration tests.",
                "Continuous Deployment only runs inside staging environments.",
              ],
              correctAnswer: "B",
              explanation: "In Continuous Delivery, every build is ready for production but requires manual approval; in Continuous Deployment, changes passing tests are automatically deployed.",
            },
          ],
        },
      ],
    },
    {
      name: "Network Security",
      examDate: datePlusDays(12),
      topics: [
        {
          name: "Cryptographic Protocols (RSA, AES & Hashing)",
          difficulty: Difficulty.HARD,
          estimatedHours: 6,
          questions: [
            {
              question: "Why is AES considered a symmetric cipher whereas RSA is an asymmetric cipher?",
              options: [
                "AES uses different keys for encryption and decryption; RSA uses identical keys.",
                "AES uses the same shared secret key for both encryption and decryption; RSA uses a public/private keypair.",
                "AES operates solely in software, while RSA requires specialized hardware security modules (HSM).",
                "AES is vulnerable to quantum attacks, whereas RSA cannot be factored by Shor's algorithm.",
              ],
              correctAnswer: "B",
              explanation: "Symmetric algorithms like AES use a single shared key, whereas asymmetric algorithms like RSA use mathematically paired public and private keys.",
            },
            {
              question: "What fundamental mathematical property protects RSA against unauthorized private key derivation?",
              options: [
                "The computational difficulty of factoring the product of two large prime numbers.",
                "The discrete logarithm problem over elliptic curve point addition.",
                "The irreversible nature of SHA-256 pre-image resistance.",
                "The difficulty of computing inverse Fourier transforms in finite Galois fields.",
              ],
              correctAnswer: "A",
              explanation: "RSA's security relies on the hardness of the integer factorization problem for the modulus n = p * q.",
            },
            {
              question: "Which cryptographic property guarantees that even a 1-bit change in input drastically changes the resulting hash output?",
              options: ["Avalanche Effect", "Collision Resistance", "Pre-image Resistance", "Perfect Forward Secrecy"],
              correctAnswer: "A",
              explanation: "The avalanche effect ensures that small variations in plaintext produce completely uncorrelated, unpredictable hash digests.",
            },
          ],
        },
        {
          name: "TLS/SSL Handshake & Transport Security",
          difficulty: Difficulty.MEDIUM,
          estimatedHours: 5,
          questions: [
            {
              question: "What is the primary role of a Certificate Authority (CA) during the TLS 1.3 handshake?",
              options: [
                "To encrypt all application payloads with a private master key.",
                "To digitally sign the server's public key, authenticating its domain identity.",
                "To route packets through a secure virtual private network tunnel.",
                "To assign dynamic IP addresses to connecting clients.",
              ],
              correctAnswer: "B",
              explanation: "A trusted CA cryptographically signs the server's certificate, allowing the client to verify domain ownership and authenticity.",
            },
            {
              question: "What security benefit does Ephemeral Diffie-Hellman (DHE / ECDHE) provide in TLS?",
              options: [
                "Zero latency handshake completion.",
                "Perfect Forward Secrecy (PFS), ensuring past sessions cannot be decrypted if the server's long-term private key is compromised.",
                "Automatic compression of all HTTP request headers.",
                "Immunity against all DNS spoofing attacks.",
              ],
              correctAnswer: "B",
              explanation: "PFS generates unique session keys per connection using temporary keypairs, preventing retrospective decryption.",
            },
          ],
        },
        {
          name: "Firewalls, IDS/IPS & Threat Mitigation",
          difficulty: Difficulty.MEDIUM,
          estimatedHours: 4,
          questions: [
            {
              question: "What differentiates a Stateful Inspection Firewall from a basic Packet Filtering Firewall?",
              options: [
                "Stateful firewalls track the state of active TCP connections and inspect context across packets.",
                "Packet filtering firewalls inspect payload application data up to OSI Layer 7.",
                "Stateful firewalls can only block UDP traffic, never TCP.",
                "Packet filtering firewalls store full connection session tables in NVRAM.",
              ],
              correctAnswer: "A",
              explanation: "Stateful inspection tracks TCP handshakes and sequence numbers, verifying incoming packets correspond to recognized, established connections.",
            },
          ],
        },
      ],
    },
    {
      name: "ADSA (Advanced Data Structures)",
      examDate: datePlusDays(15),
      topics: [
        {
          name: "Dynamic Programming & Optimal Substructure",
          difficulty: Difficulty.HARD,
          estimatedHours: 6,
          questions: [
            {
              question: "What two essential properties must a problem exhibit to be solvable via Dynamic Programming?",
              options: [
                "Optimal substructure and overlapping subproblems.",
                "Linear independence and greedy choice property.",
                "Polynomial verification and NP-completeness.",
                "Strict monotonicity and zero auxiliary space.",
              ],
              correctAnswer: "A",
              explanation: "DP is applicable when an optimal solution can be constructed from optimal subproblem solutions, and recursive calls repeatedly solve identical subproblems.",
            },
            {
              question: "What is the time and space complexity of the 0/1 Knapsack problem with n items and capacity W using tabulation?",
              options: ["Time O(n * W), Space O(n * W) or O(W)", "Time O(2^n), Space O(n)", "Time O(n log n), Space O(1)", "Time O(W^2), Space O(n)"],
              correctAnswer: "A",
              explanation: "Tabulation requires iterating through n items for capacities 1 to W, taking pseudo-polynomial O(n*W) time and O(W) space when space-optimized.",
            },
            {
              question: "How does Memoization (Top-Down) differ from Tabulation (Bottom-Up) in DP?",
              options: [
                "Memoization builds solutions iteratively from base cases; Tabulation uses recursion.",
                "Memoization caches recursive call results on-demand; Tabulation fills an iterative table systematically.",
                "Memoization never consumes call stack frames.",
                "Tabulation only works on NP-hard problems.",
              ],
              correctAnswer: "B",
              explanation: "Memoization maintains recursive flow while saving intermediate results in a lookup cache; Tabulation iteratively evaluates base cases upwards.",
            },
          ],
        },
        {
          name: "Graph Algorithms (Shortest Paths & MST)",
          difficulty: Difficulty.HARD,
          estimatedHours: 6,
          questions: [
            {
              question: "Why does standard Dijkstra's algorithm fail when applied to graphs with negative weight edges?",
              options: [
                "It greedily assumes that the shortest distance to a finalized node cannot be subsequently decreased.",
                "Priority queues do not support numeric comparison of negative values.",
                "It causes infinite loops on all Directed Acyclic Graphs (DAGs).",
                "It runs in exponential O(V!) time on negative weights.",
              ],
              correctAnswer: "A",
              explanation: "Dijkstra marks visited nodes as final based on non-negative edge accumulations; a negative edge can provide a shorter path after a vertex was finalized.",
            },
            {
              question: "Which algorithm finds all-pairs shortest paths in O(V^3) time using dynamic programming?",
              options: ["Floyd-Warshall", "Bellman-Ford", "Kruskal's Algorithm", "Tarjan's SCC Algorithm"],
              correctAnswer: "A",
              explanation: "Floyd-Warshall computes shortest paths between all pairs of vertices via intermediate vertices k in O(V^3) time.",
            },
          ],
        },
        {
          name: "Balanced Search Trees (Red-Black & AVL)",
          difficulty: Difficulty.HARD,
          estimatedHours: 5,
          questions: [
            {
              question: "In a Red-Black Tree, what is the maximum height of a tree containing n nodes?",
              options: ["2 * log2(n + 1)", "log2(n)", "n / 2", "sqrt(n)"],
              correctAnswer: "A",
              explanation: "Due to the black-height invariant and rule that no two consecutive nodes can be red, the maximum height is bounded by 2 * log2(n + 1).",
            },
          ],
        },
      ],
    },
    {
      name: "System Design",
      examDate: datePlusDays(24),
      topics: [
        {
          name: "Horizontal Scaling & Load Balancing",
          difficulty: Difficulty.MEDIUM,
          estimatedHours: 5,
          questions: [
            {
              question: "What is the difference between Layer 4 (L4) and Layer 7 (L7) load balancing?",
              options: [
                "L4 routes traffic based on IP/TCP transport data without inspecting payload; L7 inspects HTTP headers, cookies, and URLs.",
                "L4 load balancers only work with UDP traffic; L7 only works with ICMP.",
                "L7 is purely hardware-based, while L4 is exclusively implemented in software.",
                "L4 load balancing decrypts all TLS certificates before forwarding.",
              ],
              correctAnswer: "A",
              explanation: "L4 operates at the transport layer (IP and port), whereas L7 operates at the application layer, allowing intelligent routing based on HTTP content.",
            },
            {
              question: "Which load-balancing algorithm minimizes cache churn when server nodes are dynamically added or removed?",
              options: ["Consistent Hashing", "Round Robin", "Least Connections", "Random Selection"],
              correctAnswer: "A",
              explanation: "Consistent Hashing maps both servers and keys to a ring, ensuring only K/n keys need remapping when a node is added or removed.",
            },
          ],
        },
        {
          name: "Distributed Caching (Redis & Cache-Aside)",
          difficulty: Difficulty.HARD,
          estimatedHours: 5,
          questions: [
            {
              question: "In the Cache-Aside (Lazy Loading) pattern, what happens when a read request encounters a cache miss?",
              options: [
                "The application queries the database, writes the result to the cache, and returns it to the client.",
                "The cache automatically halts all incoming traffic until refreshed by background workers.",
                "The request returns a 404 error immediately.",
                "The database writes to the cache asynchronously via triggers before responding.",
              ],
              correctAnswer: "A",
              explanation: "The application code handles the miss by fetching directly from storage and populating the cache for subsequent requests.",
            },
            {
              question: "What is a 'Cache Stampede' (or Thundering Herd) and how is it mitigated?",
              options: [
                "Simultaneous cache misses for a popular key causing an overwhelming spike in database load; mitigated by mutex locks or probabilistic early expiration.",
                "When cache memory runs out and writes crash the Redis cluster.",
                "When multiple databases attempt to replicate into a single cache instance.",
                "When clients write conflicting records simultaneously without validation.",
              ],
              correctAnswer: "A",
              explanation: "A cache stampede occurs when an expired hot key causes thousands of concurrent requests to hit the backend database simultaneously.",
            },
          ],
        },
        {
          name: "Database Sharding & CAP Theorem",
          difficulty: Difficulty.HARD,
          estimatedHours: 6,
          questions: [
            {
              question: "According to the CAP Theorem, what trade-off must a distributed data store make during a Network Partition (P)?",
              options: [
                "It must choose between Consistency (C) and Availability (A).",
                "It must drop all Persistence (P) and operate entirely in RAM.",
                "It can achieve both Consistency and Availability without any compromises.",
                "It must discard horizontal partitioning and revert to single-node architecture.",
              ],
              correctAnswer: "A",
              explanation: "When network communication between nodes breaks (partition), a distributed system can either respond with stale/unavailable data (CP) or accept writes risking inconsistency (AP).",
            },
          ],
        },
      ],
    },
  ];

  for (const subjData of engineeringCurriculum) {
    let subject = await prisma.subject.findFirst({
      where: { userId: user.id, name: subjData.name },
    });

    if (!subject) {
      console.log(`Creating subject: ${subjData.name}`);
      subject = await prisma.subject.create({
        data: {
          userId: user.id,
          name: subjData.name,
          examDate: subjData.examDate,
        },
      });
    }

    for (const topData of subjData.topics) {
      let topic = await prisma.topic.findFirst({
        where: { subjectId: subject.id, name: topData.name },
      });

      if (!topic) {
        console.log(`  Creating topic: ${topData.name}`);
        topic = await prisma.topic.create({
          data: {
            subjectId: subject.id,
            name: topData.name,
            difficulty: topData.difficulty,
            estimatedHours: topData.estimatedHours,
            status: TopicStatus.ACTIVE,
          },
        });
      }

      for (const q of topData.questions) {
        const existingQ = await prisma.quizQuestion.findFirst({
          where: { topicId: topic.id, question: q.question },
        });

        if (!existingQ) {
          await prisma.quizQuestion.create({
            data: {
              topicId: topic.id,
              question: q.question,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
            },
          });
        }
      }
    }
  }

  console.log("Engineering curriculum and rich question bank seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error in seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

