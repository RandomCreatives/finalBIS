/*
 * Jest global setup: run the frontend tests on the school's clock.
 *
 * The school's devices are set to Addis Ababa (GMT+3). Running the suite in
 * that zone — not the CI machine's UTC — is what exposes time-zone bugs such
 * as building calendar dates with toISOString(), which shifts local midnight
 * back a day east of UTC.
 */
module.exports = async () => {
    process.env.TZ = 'Africa/Addis_Ababa';
};
