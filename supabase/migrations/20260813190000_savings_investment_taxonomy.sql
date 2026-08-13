set statement_timeout = '30s';

-- Ahorros mantiene el ámbito técnico aislado de la antigua sección, pero
-- distingue el dinero disponible del que se destina a inversión.
create or replace function private.seed_savings_subcategories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category_scope = 'property' and lower(new.name) = lower('Ahorros') then
    insert into public.subcategories(user_id, category_id, name, sort_order, is_active)
    values
      (new.user_id, new.id, 'Aportación', 0, true),
      (new.user_id, new.id, 'Retirada', 1, true),
      (new.user_id, new.id, 'Objetivo', 2, true),
      (new.user_id, new.id, 'Inversión', 3, true),
      (new.user_id, new.id, 'Desinversión', 4, true),
      (new.user_id, new.id, 'Otros', 5, true)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists seed_savings_subcategories_on_category on public.categories;
create trigger seed_savings_subcategories_on_category
  after insert or update of name, category_scope on public.categories
  for each row execute function private.seed_savings_subcategories();

insert into public.subcategories(user_id, category_id, name, sort_order, is_active)
select category.user_id, category.id, desired.name, desired.sort_order, true
from public.categories category
cross join (values
  ('Aportación', 0),
  ('Retirada', 1),
  ('Objetivo', 2),
  ('Inversión', 3),
  ('Desinversión', 4),
  ('Otros', 5)
) as desired(name, sort_order)
where category.category_scope = 'property'
  and lower(category.name) = lower('Ahorros')
on conflict do nothing;
