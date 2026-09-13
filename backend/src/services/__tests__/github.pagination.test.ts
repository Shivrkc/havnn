import assert from "assert";
import axios from "axios";
import prisma from "../../lib/prisma";
import { getGithubRepositories } from "../github.service";
import { encryptToken } from "../../utils/crypto";

async function runTest() {
  console.log("Starting GitHub Repository Listing Pagination Regression Test...\n");

  const originalGet = axios.get;

  const testUser = await prisma.user.create({
    data: {
      name: "Pagination Test User",
      email: `gh-pagination-${Date.now()}@example.com`,
    },
  });

  await prisma.githubAccount.create({
    data: {
      userId: testUser.id,
      githubUserId: `gh-user-${Date.now()}`,
      githubUsername: "paginationuser",
      accessToken: encryptToken("ghp_fakeToken1234567890abcdef"),
      scope: "repo",
    },
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: <= 100 repositories returns single page without extra requests
    // -------------------------------------------------------------------------
    console.log("1. Testing <=100 repositories (single page)...");
    const requestedUrls: Array<{ url: string; params: any }> = [];

    const mockReposPage1 = Array.from({ length: 45 }, (_, i) => ({
      id: 1000 + i,
      name: `repo-${i + 1}`,
      full_name: `paginationuser/repo-${i + 1}`,
      owner: { login: "paginationuser" },
      html_url: `https://github.com/paginationuser/repo-${i + 1}`,
      clone_url: `https://github.com/paginationuser/repo-${i + 1}.git`,
      default_branch: "main",
      private: false,
      description: `Test repo ${i + 1}`,
    }));

    (axios as any).get = async (url: string, config: any) => {
      requestedUrls.push({ url, params: config?.params });
      return {
        data: mockReposPage1,
        headers: {}, // No Link header when results fit on single page
      };
    };

    const reposSinglePage = await getGithubRepositories(testUser.id);

    assert.strictEqual(requestedUrls.length, 1, "Must make exactly 1 request for <= 100 repositories");
    assert.strictEqual(requestedUrls[0].params?.page, 1);
    assert.strictEqual(requestedUrls[0].params?.per_page, 100);
    assert.strictEqual(reposSinglePage.length, 45, "Must return all 45 repositories");
    assert.strictEqual(reposSinglePage[0].fullName, "paginationuser/repo-1");
    assert.strictEqual(reposSinglePage[44].fullName, "paginationuser/repo-45");
    console.log("   ✓ Single-page fetching verified: 1 request, 45 repos returned\n");

    // -------------------------------------------------------------------------
    // TEST 2: > 100 repositories follows GitHub pagination to fetch page 2
    // -------------------------------------------------------------------------
    console.log("2. Testing >100 repositories (multi-page pagination via Link header)...");
    requestedUrls.length = 0;

    const page1Repos = Array.from({ length: 100 }, (_, i) => ({
      id: 2000 + i,
      name: `repo-${i + 1}`,
      full_name: `paginationuser/repo-${i + 1}`,
      owner: { login: "paginationuser" },
      html_url: `https://github.com/paginationuser/repo-${i + 1}`,
      clone_url: `https://github.com/paginationuser/repo-${i + 1}.git`,
      default_branch: "main",
      private: i % 2 === 0,
      description: `Page 1 repo ${i + 1}`,
    }));

    const page2Repos = Array.from({ length: 35 }, (_, i) => ({
      id: 3000 + i,
      name: `repo-${100 + i + 1}`,
      full_name: `paginationuser/repo-${100 + i + 1}`,
      owner: { login: "paginationuser" },
      html_url: `https://github.com/paginationuser/repo-${100 + i + 1}`,
      clone_url: `https://github.com/paginationuser/repo-${100 + i + 1}.git`,
      default_branch: "main",
      private: false,
      description: `Page 2 repo ${100 + i + 1}`,
    }));

    (axios as any).get = async (url: string, config: any) => {
      requestedUrls.push({ url, params: config?.params });
      const page = config?.params?.page || 1;

      if (page === 1) {
        return {
          data: page1Repos,
          headers: {
            link: '<https://api.github.com/user/repos?page=2&per_page=100>; rel="next", <https://api.github.com/user/repos?page=2&per_page=100>; rel="last"',
          },
        };
      } else if (page === 2) {
        return {
          data: page2Repos,
          headers: {
            link: '<https://api.github.com/user/repos?page=1&per_page=100>; rel="prev", <https://api.github.com/user/repos?page=1&per_page=100>; rel="first"',
          },
        };
      }
      return { data: [], headers: {} };
    };

    const reposMultiPage = await getGithubRepositories(testUser.id);

    assert.strictEqual(requestedUrls.length, 2, "Must make exactly 2 requests to fetch all 135 repositories");
    assert.strictEqual(requestedUrls[0].params?.page, 1);
    assert.strictEqual(requestedUrls[1].params?.page, 2);
    assert.strictEqual(reposMultiPage.length, 135, "Must return combined 135 repositories");
    assert.strictEqual(reposMultiPage[0].fullName, "paginationuser/repo-1");
    assert.strictEqual(reposMultiPage[99].fullName, "paginationuser/repo-100");
    // Verify page 2 repositories are present
    assert.strictEqual(reposMultiPage[100].fullName, "paginationuser/repo-101");
    assert.strictEqual(reposMultiPage[134].fullName, "paginationuser/repo-135");
    console.log("   ✓ Multi-page pagination verified: 2 requests, 135 repos returned with page 2 included\n");

    // -------------------------------------------------------------------------
    // TEST 3: Explicit page parameter fetches only that specific page
    // -------------------------------------------------------------------------
    console.log("3. Testing explicit page parameter (options.page = 2)...");
    requestedUrls.length = 0;

    const pageOnlyRepos = await getGithubRepositories(testUser.id, { page: 2, perPage: 100 });

    assert.strictEqual(requestedUrls.length, 1, "Must make only 1 request when explicit page is given");
    assert.strictEqual(requestedUrls[0].params?.page, 2);
    assert.strictEqual(pageOnlyRepos.length, 35, "Must return only page 2's 35 repositories");
    assert.strictEqual(pageOnlyRepos[0].fullName, "paginationuser/repo-101");
    console.log("   ✓ Explicit page parameter verified: fetched only requested page\n");

    // -------------------------------------------------------------------------
    // TEST 4: maxPages boundary limit is respected
    // -------------------------------------------------------------------------
    console.log("4. Testing maxPages boundary enforcement...");
    requestedUrls.length = 0;

    (axios as any).get = async (url: string, config: any) => {
      requestedUrls.push({ url, params: config?.params });
      const page = config?.params?.page || 1;
      return {
        data: Array.from({ length: 100 }, (_, i) => ({
          id: page * 1000 + i,
          name: `repo-${page}-${i}`,
          full_name: `paginationuser/repo-${page}-${i}`,
        })),
        headers: {
          link: `<https://api.github.com/user/repos?page=${page + 1}&per_page=100>; rel="next"`,
        },
      };
    };

    const cappedRepos = await getGithubRepositories(testUser.id, { maxPages: 3 });
    assert.strictEqual(requestedUrls.length, 3, "Must not exceed maxPages requests");
    assert.strictEqual(cappedRepos.length, 300, "Must return exactly 300 repos for maxPages=3");
    console.log("   ✓ maxPages limit verified: stopped at page 3\n");

    console.log("==================================================================");
    console.log("  ALL GITHUB PAGINATION REGRESSION TESTS PASSED SUCCESSFULLY!     ");
    console.log("==================================================================");
  } finally {
    axios.get = originalGet;
    try {
      await prisma.githubAccount.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    } catch {}
  }
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
