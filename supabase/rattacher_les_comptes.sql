-- MAbeautyplus V2 — rattacher chaque compte à son centre.
-- À exécuter APRÈS avoir créé les 5 utilisateurs dans Authentication > Users.

insert into comptes_centre (user_id, centre_id, role)
select id, 'grau-du-roi', 'centre' from auth.users where email = 'graududroi@mabeautyplus.fr'
union all
select id, 'le-cres',     'centre' from auth.users where email = 'lecres@mabeautyplus.fr'
union all
select id, 'serignan',    'centre' from auth.users where email = 'serignan@mabeautyplus.fr'
union all
select id, 'cabestany',   'centre' from auth.users where email = 'cabestany@mabeautyplus.fr'
union all
select id, 'avignon',     'centre' from auth.users where email = 'avignon@mabeautyplus.fr'
on conflict (user_id) do update set centre_id = excluded.centre_id, role = excluded.role;

-- Contrôle : doit afficher 5 lignes, une par centre.
select c.nom as centre, u.email, cc.role
from comptes_centre cc
join centres c on c.id = cc.centre_id
join auth.users u on u.id = cc.user_id
order by c.nom;
