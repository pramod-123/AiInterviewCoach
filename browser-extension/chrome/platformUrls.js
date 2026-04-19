/**
 * Shared URL rules for practice / contest sites (toolbar enablement, popup gate, recorder tab).
 * Keep in sync with `manifest.json` host_permissions and content_scripts matches.
 */
(function initPlatformUrls(global) {
  "use strict";

  /** @type {{ id: string, re: RegExp }[]} */
  const PRACTICE_SITE_PATTERNS = [
    { id: "leetcode", re: /^https:\/\/([a-z0-9-]+\.)*leetcode\.com\//i },
    { id: "hackerrank", re: /^https:\/\/([a-z0-9-]+\.)*hackerrank\.com\//i },
    { id: "codeforces", re: /^https:\/\/(www\.)?codeforces\.com\//i },
    { id: "atcoder", re: /^https:\/\/([a-z0-9-]+\.)*atcoder\.jp\//i },
    { id: "codechef", re: /^https:\/\/(www\.)?codechef\.com\//i },
    { id: "topcoder", re: /^https:\/\/([a-z0-9-]+\.)*topcoder\.com\//i },
  ];

  /**
   * @param {string} [url]
   * @returns {boolean}
   */
  function isPracticeSiteUrl(url) {
    return typeof url === "string" && PRACTICE_SITE_PATTERNS.some((p) => p.re.test(url));
  }

  global.ICPracticeSitePatterns = PRACTICE_SITE_PATTERNS;
  global.ICIsPracticeSiteUrl = isPracticeSiteUrl;
})(typeof globalThis !== "undefined" ? globalThis : this);
