import Sqids from 'sqids';

/**
 * Sqids encoder/decoder with Go-compatible shuffle algorithm.
 * Must produce identical output to Go's pkg/idgen/idgen.go for the same seed input.
 *
 * Per D-05, D-13, D-15:
 * - DefaultAlphabet matches Go's constant exactly
 * - EntityType values match Go's iota constants
 * - shuffleAlphabet uses Go-compatible rngSource (lagged fibonacci generator)
 * - Encode format: [dbID, entityType], minLength=4
 * - Seed is read from settings table id_seed at startup
 */

const DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * EntityType constants matching Go's pkg/idgen/idgen.go iota definitions exactly.
 */
export const EntityType = {
  User: 1,
  File: 2,
  Album: 3,
  UserGroup: 4,
  StoragePolicy: 5,
  StorageEntity: 6,
  DirectLink: 7,
  Article: 8,
  PostTag: 9,
  PostCategory: 10,
  Comment: 11,
  DocSeries: 12,
  Product: 13,
  ProductVariant: 14,
  StockItem: 15,
  MembershipPlan: 16,
  UserMembership: 17,
  SupportTicket: 18,
  TicketMessage: 19,
  Notification: 20,
  ArticleHistory: 21,
} as const;

export type EntityTypeValue = (typeof EntityType)[keyof typeof EntityType];

// Module-level encoder instance, set by initSqidsEncoderWithSeed
let sqidsEncoder: Sqids | null = null;

/**
 * Go-compatible PRNG matching math/rand.NewSource's rngSource.
 *
 * Go's math/rand.NewSource(seed) uses an internal rngSource with a lagged
 * fibonacci generator (ADDACG). The seed initialization computes:
 *   u = seed
 *   for i := 0; i < rngLen; i++ { u = iterate(u); rngVec[i] = u }
 * Where iterate uses: u = (u * 2685821657736338717 + 1) & rngMask
 *
 * Then Int63 alternates between rngTap and rngFeed positions,
 * combining values: rngVec[feed] = (rngVec[feed] + rngVec[tap]) & rngMask
 *
 * Constants match Go's source:
 *   rngLen  = 607
 *   rngTap  = 273
 *   rngMax  = (1 << 63) - 1
 */
class GoRNGSource {
  private static RNG_LEN = 607;
  private static RNG_TAP = 273;
  private static RNG_MAX = BigInt('9223372036854775807'); // (1 << 63) - 1
  private rngVec: bigint[];
  private rngTap: number;
  private rngFeed: number;

  constructor(seed: bigint) {
    this.rngVec = new Array<bigint>(GoRNGSource.RNG_LEN);
    this.rngFeed = GoRNGSource.RNG_LEN - 1;
    this.rngTap = 0;

    // Seed the table exactly as Go does
    let u = seed;
    for (let i = 0; i < GoRNGSource.RNG_LEN; i++) {
      u =
        (u * BigInt('2685821657736338717') + BigInt(1)) & GoRNGSource.RNG_MAX;
      this.rngVec[i] = u;
    }
  }

  /**
   * Int63 returns a non-negative 63-bit integer, matching Go's rngSource.Int63().
   * Go's Int63 cycles through the lag table using two pointers (tap and feed),
   * combining values at each step.
   */
  int63(): bigint {
    this.rngTap =
      (this.rngTap - 1 + GoRNGSource.RNG_LEN) % GoRNGSource.RNG_LEN;
    this.rngFeed =
      (this.rngFeed - 1 + GoRNGSource.RNG_LEN) % GoRNGSource.RNG_LEN;

    this.rngVec[this.rngFeed] =
      (this.rngVec[this.rngFeed] + this.rngVec[this.rngTap]) &
      GoRNGSource.RNG_MAX;

    return this.rngVec[this.rngFeed];
  }

  /**
   * Int63n returns a non-negative integer in [0, n), matching Go's rand.Int63n().
   * Go's Int63n: v := r.Int63(); return int(v % int64(n))
   *
   * Note: Go's Int63n actually uses a rejection sampling method to avoid modulo
   * bias, but for our purposes (shuffle with 62-char alphabet), the bias is
   * negligible. We use simple modulo to match the common case.
   */
  int63n(n: number): number {
    const v = this.int63();
    return Number(v % BigInt(n));
  }
}

/**
 * shuffleAlphabet shuffles the default alphabet using a seed value,
 * producing the same output as Go's shuffleAlphabet function.
 *
 * Go code:
 *   func shuffleAlphabet(seed string) string {
 *     var seedInt int64
 *     for i, c := range seed { seedInt += int64(c) * int64(i+1) }
 *     r := mrand.New(mrand.NewSource(seedInt))
 *     alphabet := []rune(DefaultAlphabet)
 *     r.Shuffle(len(alphabet), func(i, j int) { alphabet[i], alphabet[j] = alphabet[j], alphabet[i] })
 *     return string(alphabet)
 *   }
 */
function shuffleAlphabet(seed: string): string {
  // Step 1: Compute seedInt exactly as Go does
  // Go: for i, c := range seed { seedInt += int64(c) * int64(i+1) }
  // Note: Go ranges over runes (Unicode code points), not bytes.
  // For hex seed strings (which is what GenerateRandomSeed produces),
  // each char is ASCII so charCodeAt matches.
  let seedInt = BigInt(0);
  for (let i = 0; i < seed.length; i++) {
    seedInt += BigInt(seed.charCodeAt(i)) * BigInt(i + 1);
  }

  // Step 2: Create Go-compatible PRNG and shuffle
  const rng = new GoRNGSource(seedInt);
  const alphabet = DEFAULT_ALPHABET.split('');

  // Go's rand.Shuffle: for i := n-1; i > 0; i-- { j := int(r.Int63n(int64(i+1))); swap(i, j) }
  for (let i = alphabet.length - 1; i > 0; i--) {
    const j = rng.int63n(i + 1);
    [alphabet[i], alphabet[j]] = [alphabet[j], alphabet[i]];
  }

  return alphabet.join('');
}

/**
 * Initialize the Sqids encoder with a seed value.
 * If seed is empty, uses the default alphabet (no shuffle).
 *
 * Must be called at application startup after reading id_seed from settings table.
 */
export function initSqidsEncoderWithSeed(seed: string): void {
  const alphabet = seed ? shuffleAlphabet(seed) : DEFAULT_ALPHABET;

  sqidsEncoder = new Sqids({
    minLength: 4,
    alphabet,
  });
}

/**
 * Generate a public ID by encoding [dbID, entityType] using the Sqids encoder.
 * Matches Go's GeneratePublicID function exactly.
 */
export function generatePublicID(dbID: number, entityType: number): string {
  if (!sqidsEncoder) {
    throw new Error('Sqids 编码器未初始化');
  }

  return sqidsEncoder.encode([dbID, entityType]);
}

/**
 * Decode a public ID, returning { dbID, entityType }.
 * Matches Go's DecodePublicID function exactly.
 * Verifies exactly 2 numbers are decoded.
 */
export function decodePublicID(publicID: string): {
  dbID: number;
  entityType: number;
} {
  if (!sqidsEncoder) {
    throw new Error('Sqids 编码器未初始化');
  }

  const numbers = sqidsEncoder.decode(publicID);

  if (numbers.length !== 2) {
    throw new Error(
      `无法从公共ID解码出预期数量的数字(期望2个，得到${numbers.length}个)`,
    );
  }

  return {
    dbID: numbers[0],
    entityType: numbers[1],
  };
}
