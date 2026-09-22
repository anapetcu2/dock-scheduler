"""Developer-machine commands. Never run at request time (see SPEC.md
section 10: the app must not write to the filesystem at runtime, and
migrations/import never run at app startup).
"""

import json

import click

from app.auth.security import hash_password
from app.config import get_settings
from app.db import make_engine
from app.models.users import User, UserRole


def _direct_session():
    from sqlalchemy.orm import sessionmaker

    settings = get_settings()
    engine = make_engine(settings.database_url_direct, pooled=False)
    return sessionmaker(bind=engine)()


@click.group()
def cli() -> None:
    pass


@cli.command("create-user")
@click.option("--email", prompt=True)
@click.option("--name", prompt=True)
@click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True)
@click.option("--role", type=click.Choice(["staff", "admin"]), prompt=True)
def create_user(email: str, name: str, password: str, role: str) -> None:
    session = _direct_session()
    try:
        if session.query(User).filter(User.email == email).first() is not None:
            raise click.ClickException(f"A user with email {email} already exists.")
        user = User(
            email=email,
            name=name,
            password_hash=hash_password(password),
            role=UserRole(role),
            is_active=True,
        )
        session.add(user)
        session.commit()
        click.echo(f"Created {role} user {email} (id={user.id}).")
    finally:
        session.close()


@cli.command("seed-demo")
def seed_demo() -> None:
    """Create a demo admin and a demo staff user. Passwords come from
    SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD, or are prompted for."""
    settings = get_settings()
    session = _direct_session()
    try:
        admin_password = settings.seed_admin_password or click.prompt(
            "Password for demo admin (admin@dockscheduler.local)", hide_input=True
        )
        demo_password = settings.seed_demo_password or click.prompt(
            "Password for demo staff (staff@dockscheduler.local)", hide_input=True
        )

        seeds = [
            ("admin@dockscheduler.local", "Demo Admin", admin_password, UserRole.admin),
            ("staff@dockscheduler.local", "Demo Staff", demo_password, UserRole.staff),
        ]
        for email, name, password, role in seeds:
            existing = session.query(User).filter(User.email == email).first()
            if existing is not None:
                click.echo(f"{email} already exists, skipping.")
                continue
            session.add(
                User(
                    email=email,
                    name=name,
                    password_hash=hash_password(password),
                    role=role,
                    is_active=True,
                )
            )
            click.echo(f"Created {role.value} user {email}.")
        session.commit()
    finally:
        session.close()


@cli.command("export-openapi")
def export_openapi() -> None:
    """Print the app's OpenAPI schema as JSON (redirect to frontend/openapi.json)."""
    from app.main import app as fastapi_app

    click.echo(json.dumps(fastapi_app.openapi()))


@cli.command("import-workbook")
@click.argument("path", type=click.Path(exists=True))
@click.option("--dry-run", is_flag=True, default=False)
@click.option("--reset", is_flag=True, default=False)
def import_workbook(path: str, dry_run: bool, reset: bool) -> None:
    """Import the historical Excel workbook. Implemented in Phase 4."""
    raise click.ClickException(
        "The importer (importer/) hasn't been built yet — this is Phase 4 of SPEC.md."
    )


if __name__ == "__main__":
    cli()
