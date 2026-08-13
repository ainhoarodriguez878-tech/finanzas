set statement_timeout = '30s';

-- Esta migración solo adapta el espacio de trabajo de cada usuario del fork.
-- La antigua categoría de propiedad se conserva como el ámbito técnico
-- aislado, pero pasa a representar los ahorros personales.

alter function public.bootstrap_user_workspace()
  rename to bootstrap_user_workspace_legacy;

create or replace function public.bootstrap_user_workspace()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  result jsonb;
  savings_category_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  result := public.bootstrap_user_workspace_legacy();

  update public.categories old_category
  set name = 'Ahorros'
  where old_category.user_id = current_user_id
    and old_category.category_scope = 'property'
    and lower(old_category.name) = lower('Piso Málaga')
    and not exists (
      select 1
      from public.categories current_category
      where current_category.user_id = current_user_id
        and lower(current_category.name) = lower('Ahorros')
    );

  select category.id
    into savings_category_id
  from public.categories category
  where category.user_id = current_user_id
    and category.category_scope = 'property'
    and lower(category.name) = lower('Ahorros')
  order by category.sort_order, category.id
  limit 1;

  if savings_category_id is null then
    insert into public.categories(user_id, name, category_scope, sort_order, is_active)
    values (current_user_id, 'Ahorros', 'property', 0, true)
    on conflict do nothing
    returning id into savings_category_id;

    if savings_category_id is null then
      select category.id
        into savings_category_id
      from public.categories category
      where category.user_id = current_user_id
        and category.category_scope = 'property'
        and lower(category.name) = lower('Ahorros')
      order by category.sort_order, category.id
      limit 1;
    end if;
  end if;

  insert into public.subcategories(user_id, category_id, name, sort_order, is_active)
  values
    (current_user_id, savings_category_id, 'Aportación', 0, true),
    (current_user_id, savings_category_id, 'Retirada', 1, true),
    (current_user_id, savings_category_id, 'Objetivo', 2, true),
    (current_user_id, savings_category_id, 'Otros', 3, true)
  on conflict do nothing;

  update public.properties property
  set name = 'Ahorros', property_type = 'savings'
  where property.user_id = current_user_id
    and lower(property.name) = lower('Piso Málaga')
    and not exists (
      select 1
      from public.properties current_property
      where current_property.user_id = current_user_id
        and lower(current_property.name) = lower('Ahorros')
    );

  if not exists (select 1 from public.properties property where property.user_id = current_user_id) then
    insert into public.properties(user_id, name, property_type, is_active)
    values (current_user_id, 'Ahorros', 'savings', true)
    on conflict do nothing;
  end if;

  update public.transactions
  set context = 'Ahorros'
  where user_id = current_user_id
    and lower(context) = lower('Piso Málaga');

  update public.recurring_rules
  set context = 'Ahorros'
  where user_id = current_user_id
    and lower(context) = lower('Piso Málaga');

  return result || jsonb_build_object('has_malaga_access', true);
end;
$$;

comment on function public.bootstrap_user_workspace() is
  'Creates the authenticated user workspace and provisions its private Ahorros section.';

revoke all on function public.bootstrap_user_workspace() from public, anon;
grant execute on function public.bootstrap_user_workspace() to authenticated;

-- Actualiza también los datos que ya existan en este proyecto propio. No hay
-- ninguna referencia a otro repositorio o a otra cuenta de GitHub.
update public.categories old_category
set name = 'Ahorros'
where old_category.category_scope = 'property'
  and lower(old_category.name) = lower('Piso Málaga')
  and not exists (
    select 1
    from public.categories current_category
    where current_category.user_id is not distinct from old_category.user_id
      and lower(current_category.name) = lower('Ahorros')
  );

update public.properties old_property
set name = 'Ahorros', property_type = 'savings'
where lower(old_property.name) = lower('Piso Málaga')
  and not exists (
    select 1
    from public.properties current_property
    where current_property.user_id is not distinct from old_property.user_id
      and lower(current_property.name) = lower('Ahorros')
  );

update public.transactions
set context = 'Ahorros'
where lower(context) = lower('Piso Málaga');

update public.recurring_rules
set context = 'Ahorros'
where lower(context) = lower('Piso Málaga');

insert into public.subcategories(user_id, category_id, name, sort_order, is_active)
select category.user_id, category.id, desired.name, desired.sort_order, true
from public.categories category
cross join (values
  ('Aportación', 0),
  ('Retirada', 1),
  ('Objetivo', 2),
  ('Otros', 3)
) as desired(name, sort_order)
where category.category_scope = 'property'
  and lower(category.name) = lower('Ahorros')
on conflict do nothing;
