use crate::*;

pub fn add_authorized_updater(
    ctx: Context<crate::AddAuthorizedUpdater>,
    new_updater: Pubkey,
) -> Result<()> {
    // gate by any existing authorized updater
    require!(
        ctx.accounts
            .global
            .authorized_updaters
            .iter()
            .any(|k| *k == ctx.accounts.updater.key()),
        crate::DdError::Unauthorized
    );
    let g = &mut ctx.accounts.global;
    if !g.authorized_updaters.iter().any(|k| *k == new_updater) {
        g.authorized_updaters.push(new_updater);
    }
    Ok(())
}

pub fn remove_authorized_updater(
    ctx: Context<crate::RemoveAuthorizedUpdater>,
    remove: Pubkey,
) -> Result<()> {
    // gate by any existing authorized updater
    require!(
        ctx.accounts
            .global
            .authorized_updaters
            .iter()
            .any(|k| *k == ctx.accounts.updater.key()),
        crate::DdError::Unauthorized
    );
    let g = &mut ctx.accounts.global;
    // Only authority itself may remove the authority key from the list
    if remove == g.authority && ctx.accounts.updater.key() != g.authority {
        return err!(crate::DdError::Unauthorized);
    }
    g.authorized_updaters.retain(|k| *k != remove);
    Ok(())
}
