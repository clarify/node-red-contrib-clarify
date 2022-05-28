const ORIGINAL_SET_TIMEOUT = setTimeout;

export function waitUntil(verify: () => boolean) {
  let duration = 0;
  return new Promise((resolve, reject) => {
    let value = verify();
    if (value) {
      return resolve(value);
    }

    function schedule() {
      ORIGINAL_SET_TIMEOUT(() => {
        duration += 10;
        try {
          let value = verify();
          if (value) {
            return resolve(value);
          }
        } catch (error) {
          reject(error);
        }
        if (duration > 1000) {
          return reject('Timed out');
        }
        schedule();
      }, 10);
    }
    schedule();
  });
}
