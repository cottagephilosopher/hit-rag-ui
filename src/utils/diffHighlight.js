/**
 * 文本差异高亮工具
 * 基于 LCS (最长公共子序列) 算法实现行级和字符级的文本对比
 */

/**
 * HTML 转义，防止 XSS 攻击
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, char => map[char])
}

/**
 * 规范化数据用于对比
 */
function normalizeForDiff(value) {
  if (value == null) return ''
  if (Array.isArray(value)) {
    return value.join('\n')
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch (error) {
      return String(value)
    }
  }
  return String(value)
}

/**
 * 分割文本为行数组
 */
function splitLines(text) {
  if (text === '') {
    return ['']
  }
  return text.split(/\r?\n/)
}

/**
 * 找到两个字符串的公共前缀长度
 */
function commonPrefix(a, b) {
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && a[i] === b[i]) {
    i++
  }
  return i
}

/**
 * 找到两个字符串的公共后缀长度
 */
function commonSuffix(a, b, prefixLength) {
  const aLen = a.length
  const bLen = b.length
  const max = Math.min(aLen - prefixLength, bLen - prefixLength)
  let i = 0
  while (i < max && a[aLen - 1 - i] === b[bLen - 1 - i]) {
    i++
  }
  return i
}

/**
 * 行级 Diff 算法 (基于 LCS 动态规划)
 * 时间复杂度: O(m * n)
 * 空间复杂度: O(m * n)
 */
function diffLines(beforeLines, afterLines) {
  const m = beforeLines.length
  const n = afterLines.length

  // 构建 DP 表
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  // 填充 DP 表 (从后向前)
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (beforeLines[i] === afterLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  // 回溯构造 diff 结果
  const result = []
  let i = 0
  let j = 0

  while (i < m && j < n) {
    if (beforeLines[i] === afterLines[j]) {
      result.push({
        type: 'equal',
        before: beforeLines[i],
        after: afterLines[j]
      })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({
        type: 'delete',
        before: beforeLines[i]
      })
      i++
    } else {
      result.push({
        type: 'insert',
        after: afterLines[j]
      })
      j++
    }
  }

  // 处理剩余的删除行
  while (i < m) {
    result.push({ type: 'delete', before: beforeLines[i] })
    i++
  }

  // 处理剩余的插入行
  while (j < n) {
    result.push({ type: 'insert', after: afterLines[j] })
    j++
  }

  return result
}

/**
 * 字符级 Diff (基于公共前后缀)
 * 用于修改的行，提供更精确的高亮
 */
function inlineDiff(beforeLine, afterLine) {
  if (beforeLine === afterLine) {
    const escaped = escapeHtml(beforeLine) || '&nbsp;'
    return { before: escaped, after: escaped }
  }

  const prefixLength = commonPrefix(beforeLine, afterLine)
  const suffixLength = commonSuffix(beforeLine, afterLine, prefixLength)

  const beforePrefix = escapeHtml(beforeLine.slice(0, prefixLength))
  const beforeDiff = escapeHtml(beforeLine.slice(prefixLength, beforeLine.length - suffixLength)) || '&nbsp;'
  const beforeSuffix = escapeHtml(beforeLine.slice(beforeLine.length - suffixLength))

  const afterPrefix = escapeHtml(afterLine.slice(0, prefixLength))
  const afterDiff = escapeHtml(afterLine.slice(prefixLength, afterLine.length - suffixLength)) || '&nbsp;'
  const afterSuffix = escapeHtml(afterLine.slice(afterLine.length - suffixLength))

  return {
    before: `${beforePrefix}<span class="diff-mark diff-remove">${beforeDiff}</span>${beforeSuffix}`,
    after: `${afterPrefix}<span class="diff-mark diff-add">${afterDiff}</span>${afterSuffix}`
  }
}

/**
 * 主函数：高亮两个值之间的差异
 * @param {unknown} before - 修改前的值
 * @param {unknown} after - 修改后的值
 * @returns {{ before: string, after: string }} - 带高亮标记的 HTML
 */
export function highlightDiff(before, after) {
  // 1. 规范化数据
  const beforeText = normalizeForDiff(before)
  const afterText = normalizeForDiff(after)

  // 2. 快速路径：内容相同
  if (beforeText === afterText) {
    const escaped = escapeHtml(beforeText)
    return { before: escaped, after: escaped }
  }

  // 3. 分割成行
  const beforeLines = splitLines(beforeText)
  const afterLines = splitLines(afterText)

  // 4. 行级 diff
  const diffs = diffLines(beforeLines, afterLines)

  // 5. 构建 HTML
  const beforeParts = []
  const afterParts = []

  for (let i = 0; i < diffs.length; i++) {
    const part = diffs[i]

    // 5.1 未修改的行
    if (part.type === 'equal') {
      const escaped = escapeHtml(part.before ?? '') || '&nbsp;'
      beforeParts.push(`<span class="diff-line">${escaped}</span>`)
      afterParts.push(`<span class="diff-line">${escaped}</span>`)
      continue
    }

    // 5.2 修改的行 (delete + insert) - 使用字符级 diff
    if (part.type === 'delete' &&
        i + 1 < diffs.length &&
        diffs[i + 1].type === 'insert') {
      const next = diffs[i + 1]
      const inline = inlineDiff(part.before ?? '', next.after ?? '')
      beforeParts.push(`<span class="diff-line diff-line-remove">${inline.before}</span>`)
      afterParts.push(`<span class="diff-line diff-line-add">${inline.after}</span>`)
      i++ // 跳过下一个 insert
      continue
    }

    // 5.3 纯删除的行
    if (part.type === 'delete') {
      const escaped = escapeHtml(part.before ?? '') || '&nbsp;'
      beforeParts.push(`<span class="diff-line diff-line-remove">${escaped}</span>`)
      afterParts.push('<span class="diff-line diff-line-placeholder">&nbsp;</span>')
      continue
    }

    // 5.4 纯插入的行
    if (part.type === 'insert') {
      const escaped = escapeHtml(part.after ?? '') || '&nbsp;'
      beforeParts.push('<span class="diff-line diff-line-placeholder">&nbsp;</span>')
      afterParts.push(`<span class="diff-line diff-line-add">${escaped}</span>`)
      continue
    }
  }

  return {
    before: beforeParts.join(''),
    after: afterParts.join('')
  }
}