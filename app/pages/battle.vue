<script setup lang="ts">
/**
 * /battle — full-screen Reels-style city battle feed.
 *
 * No header/footer chrome. Vertical video matchups: watch both clips,
 * pick the winner, see the result, swipe to the next matchup.
 * Reuses battleMatchup / battleVote / cityLeaderboard tRPC endpoints.
 */
definePageMeta({ layout: false })

useHead({
  title: 'City Battle — WeDance',
  meta: [
    { name: 'description', content: 'Which city dances best? Watch, vote, and decide in our Reels-style city battle.' },
  ],
})
</script>

<template>
  <BattleFeed />
</template>
